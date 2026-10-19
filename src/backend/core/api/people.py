"""
The people a collaborator works with (themselves first), to mention or to
put in a table's Person cell straight away: no minimum length to type, since only people
already close to them are listed (people they share pages with, members of
their workspaces), never the whole platform.
"""

import rest_framework as drf
from rest_framework.views import APIView

from core import models
from core.api import permissions
from core.api.filters import remove_accents
from core.api.serializers import UserSerializer
from core.utils.users import users_sharing_documents_with

# Everyone one works with, as a scrolling list; a safety bound only
PEOPLE_LIMIT = 500


class KnownPeopleView(APIView):
    """GET /api/v1.0/people/?q=<any text> — closest first."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """The people the requester works with whose name or email match."""
        closeness = users_sharing_documents_with(request.user.id)
        query = remove_accents((request.query_params.get("q") or "").strip()).lower()
        people = [
            person
            for person in models.User.objects.filter(
                id__in=list(closeness), is_active=True
            )
            if not query
            or query in remove_accents(person.full_name or "").lower()
            or query in (person.email or "").lower()
        ]
        people.sort(key=lambda person: closeness[person.id], reverse=True)
        # Oneself first: to mention oneself, or take a row in a Person cell
        me = request.user
        if (
            not query
            or query in remove_accents(me.full_name or "").lower()
            or query in (me.email or "").lower()
        ):
            people.insert(0, me)
        return drf.response.Response(
            UserSerializer(people[:PEOPLE_LIMIT], many=True).data
        )


class PersonCardView(APIView):
    """
    GET /api/v1.0/people/<id>/ — the card shown when hovering a mention.

    For someone the requester works with: their name, email, the workspaces
    they share and their groups there. For anyone else, only the name (which
    the mention shows anyway).
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, user_id):
        """A person's card, as much as the requester may see."""
        person = models.User.objects.filter(id=user_id, is_active=True).first()
        if person is None:
            raise drf.exceptions.NotFound()
        me = request.user
        card = {
            "id": str(person.id),
            "full_name": person.full_name or "",
            "short_name": person.short_name or "",
            "is_me": person.id == me.id,
            "known": False,
            "email": "",
            "workspaces": [],
            "groups": [],
        }
        known = person.id == me.id or person.id in users_sharing_documents_with(me.id)
        if not known:
            return drf.response.Response(card)
        shared = models.Workspace.objects.filter(accesses__user=me).filter(
            accesses__user=person
        )
        card.update(
            {
                "known": True,
                "email": person.email or "",
                "workspaces": [
                    {"id": str(workspace.id), "name": workspace.name}
                    for workspace in shared.distinct().order_by("name")
                ],
                "groups": [
                    {"id": str(group.id), "name": group.name}
                    for group in models.Group.objects.filter(
                        workspace__in=shared, memberships__user=person
                    )
                    .distinct()
                    .order_by("name")
                ],
            }
        )
        return drf.response.Response(card)
