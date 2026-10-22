"""Local stdio tools run as the instance maintainer. Never give this to learners."""
import os
from mcp.server.fastmcp import FastMCP
from base.core import Store
from base.app.activities import generation_context
from base.app.assessment import validate_activity

server = FastMCP('base')


def store():
    return Store(os.environ.get('BASE_DATA', 'data/base'))


@server.tool()
def get_context() -> dict:
    """Read the editable business context, material and generation prompt."""
    return generation_context()


@server.tool()
def check_activity(draft: dict) -> dict:
    """Check a draft without publishing. Errors do not mean semantic review passed."""
    try:
        validate_activity(draft)
        return {'valid': True}
    except ValueError as error:
        return {'valid': False, 'error': str(error)}


@server.tool()
def create_activity(learner: str, draft: dict, request_key: str) -> dict:
    """Explicit maintainer action: publish a checked activity and return its relative learning URL. Confirm content before calling."""
    result = store().create(learner, draft, request_key)
    return {**result, 'student_path': '/learn/' + result['token']}


@server.tool()
def list_records() -> dict:
    """Private maintainer records. Do not disclose other learners' data."""
    service = store()
    return {'tasks': service.tasks(), 'submissions': service.submissions()}


@server.tool()
def record_feedback(submission_id: str, comment: str, next_step: str) -> dict:
    """Save maintainer-authorized feedback and next action."""
    return store().feedback(submission_id, comment, next_step)


if __name__ == '__main__':
    server.run(transport='stdio')
