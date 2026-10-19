"""
The people a collaborator works with, to mention or to put in a table's
Person cell straight away: no minimum length to type, since only people
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
        return drf.response.Response(
            UserSerializer(people[:PEOPLE_LIMIT], many=True).data
        )
