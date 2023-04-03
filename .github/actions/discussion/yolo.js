const core = require('@actions/core');
const github = require('@actions/github');

const categories = {
  request: 'DIC_kwDOJJzAY84CVZ_1',
  question: 'DIC_kwDOJJzAY84CVZ_2',
};

async function request() {
  const octokit = github.getOctokit(github.context.token);
  const payload = github.context.payload;
  const number = payload.discussion.number;
  const author = payload.discussion.author.login;

  function addComment() {
    const input = {
      discussionId: payload.discussion.node_id,
      body: `@${author}`,
    };
    return octokit.graphql(`mutation($input: AddDiscussionCommentInput!) {
      addDiscussionComment(input: $input) {
        comment {
          id
        }
      }
    }`, { input });
  }

  function updateComment(commentId, numbers) {
    const input = {
      commentId,
      body: [
        `@${author}`,
        ...numbers.map((number) => `- [ ] #${number}`),
      ].join('\n'),
    };
    return octokit.graphql(`mutation($input: UpdateDiscussionCommentInput!) {
      updateDiscussionComment(input: $input) {
        comment {
          id
        }
      }
    }`, { input });
  }

  function createQuestion(cbNodeId, current, total) {
    const input = {
      repositoryId: payload.repository.node_id,
      title: `Request #${number} from ${author} (${current}/${total})`,
      body: [
        `Request: #${number} @${author}`,
        `Callback: ${cbNodeId}`,
      ].join('\n'),
      categoryId: categories.question,
    };
    return octokit.graphql(`mutation($input: CreateDiscussionInput!) {
      createDiscussion(input: $input) {
        discussion {
          number
        }
      }
    }`, { input });
  }

  const { comment } = await addComment();
  const discussions = [];
  for (let i = 1; i <= 2; i++) {
    const { discussion } = await createQuestion(comment.id, i, 2);
    discussions.push(discussion.number);
  }
  await updateComment(comment.id, discussions);
}

async function main() {
  const action = github.context.action;
  switch (action) {
    case 'request':
      await request();
      break;
    default:
      throw new Error(`Unknown type: ${action}`);
  }
}

try {
  main();
} catch (error) {
  core.setFailed(error.message);
}
