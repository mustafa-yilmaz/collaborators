"""User sharing cache utilities."""

import logging
import time

from django.core.cache import cache
from django.db import models as db
from django.db.models import Subquery

from core import models

logger = logging.getLogger(__name__)


def forget_all_people():
    """
    Collaborators: who shares something with whom is computed again, for
    everyone (a role on a space reaches the people of all its pages, a
    group's members, a workspace's members).
    """
    cache.delete_many(
        [
            get_users_sharing_documents_with_cache_key(user_id)
            for user_id in models.User.objects.values_list("id", flat=True)
        ]
    )


def get_users_sharing_documents_with_cache_key(user_id):
    """Generate a unique cache key for each user."""
    return f"users_sharing_documents_with_{user_id}"


def _team_members(team):
    """The users a team string stands for."""
    kind, obj_id = models.parse_team(team)
    if kind == models.TEAM_GROUP:
        return models.GroupMembership.objects.filter(group_id=obj_id).values_list(
            "user_id", flat=True
        )
    if kind == models.TEAM_WORKSPACE:
        return models.WorkspaceAccess.objects.filter(workspace_id=obj_id).values_list(
            "user_id", flat=True
        )
    if kind == models.TEAM_WORKSPACE_ADMINS:
        return models.WorkspaceAccess.objects.filter(
            workspace_id=obj_id, role__in=models.WORKSPACE_PRIVILEGED_ROLES
        ).values_list("user_id", flat=True)
    return []


def _related_paths_query(paths, steplen):
    """Documents above, at or under any of these paths."""
    # under a path also under another one: covered by the higher one
    kept = sorted(set(paths), key=len)
    tops = []
    for path in kept:
        if not any(path.startswith(top) for top in tops):
            tops.append(path)
    above = {path[:end] for path in kept for end in range(steplen, len(path), steplen)}
    query = db.Q(document__path__in=above)
    for top in tops:
        query |= db.Q(document__path__startswith=top)
    return query


def users_sharing_documents_with(user_id):
    """
    Returns a map of users sharing documents with the given user,
    sorted by last shared date.

    Collaborators: "sharing" is having a role in the same tree, the one
    above or under the other (a space and its pages), directly or through a
    group or a workspace, or being members of the same workspace.
    """
    start_time = time.time()
    cache_key = get_users_sharing_documents_with_cache_key(user_id)
    cached_result = cache.get(cache_key)

    if cached_result is not None:
        elapsed = time.time() - start_time
        logger.info(
            "users_sharing_documents_with cache hit for user %s (took %.3fs)",
            user_id,
            elapsed,
        )
        return cached_result

    result = {}

    def note(other_id, when):
        if other_id and other_id != user_id:
            previous = result.get(other_id)
            if previous is None or when > previous:
                result[other_id] = when

    teams = (
        models.User.objects.filter(pk=user_id)
        .values_list("collaborator_teams", flat=True)
        .first()
    ) or []
    my_paths = list(
        models.DocumentAccess.objects.filter(
            db.Q(user_id=user_id) | db.Q(team__in=teams),
            document__deleted_at__isnull=True,
        )
        .values_list("document__path", flat=True)
        .distinct()
    )
    if my_paths:
        shared = (
            models.DocumentAccess.objects.filter(
                _related_paths_query(my_paths, models.Document.steplen)
            )
            .values("user", "team")
            .annotate(last_shared=db.Max("created_at"))
        )
        for item in shared:
            if item["user"]:
                note(item["user"], item["last_shared"])
            elif item["team"]:
                # a group or a workspace: each of its members
                for member_id in _team_members(item["team"]):
                    note(member_id, item["last_shared"])

    # Collaborators: the members of my workspaces count as close too, so that
    # they can be found by name to share with or to mention
    my_workspaces_qs = models.WorkspaceAccess.objects.filter(
        user__id=user_id
    ).values_list("workspace_id", flat=True)
    co_members_qs = (
        models.WorkspaceAccess.objects.filter(
            workspace_id__in=Subquery(my_workspaces_qs)
        )
        .exclude(user__id=user_id)
        .values("user")
        .annotate(last_shared=db.Max("created_at"))
    )
    for item in co_members_qs:
        note(item["user"], item["last_shared"])

    cache.set(cache_key, result, 86400)  # Cache for 1 day
    elapsed = time.time() - start_time
    logger.info(
        "users_sharing_documents_with cache miss for user %s (took %.3fs)",
        user_id,
        elapsed,
    )
    return result


def findable_user_ids():
    """Those who let everyone on the platform find them (or the internet)."""
    return models.UserProfile.objects.filter(
        reach__in=[models.ProfileAudience.PLATFORM, models.ProfileAudience.PUBLIC],
        user__is_active=True,
    ).values_list("user_id", flat=True)


def can_find(viewer_id, other_id):
    """
    Collaborators: whether one may find, see and invite another: they share
    a workspace, a space or a page, or the other lets everyone find them.
    """
    if viewer_id == other_id:
        return True
    if other_id in users_sharing_documents_with(viewer_id):
        return True
    return models.UserProfile.objects.filter(
        user_id=other_id,
        reach__in=[models.ProfileAudience.PLATFORM, models.ProfileAudience.PUBLIC],
    ).exists()
