const core = require("@actions/core");
const github = require("@actions/github");

const categories = {
  request: "DIC_kwDOJJzAY84CVZ_1",
  question: "DIC_kwDOJJzAY84CVZ_2",
};

async function request() {
  const octokit = github.getOctokit(core.getInput("token"));
  const payload = github.context.payload;
  const number = payload.discussion.number;
  const author = payload.discussion.user.login;

  function addComment() {
    const input = {
      discussionId: payload.discussion.node_id,
      body: `@${author}`,
    };
    return octokit.graphql(
      `mutation($input: AddDiscussionCommentInput!) {
      addDiscussionComment(input: $input) {
        comment {
          id
        }
      }
    }`,
      { input },
    );
  }

  function updateComment(commentId, numbers) {
    const input = {
      commentId,
      body: [
        `@${author}`,
        ...numbers.map((number) => `- [ ] #${number}`),
      ].join("\n"),
    };
    return octokit.graphql(
      `mutation($input: UpdateDiscussionCommentInput!) {
      updateDiscussionComment(input: $input) {
        comment {
          id
        }
      }
    }`,
      { input },
    );
  }

  const NUMBER_OF_QUESTIONS = 2;
  function ask(cbNodeId, current, total = NUMBER_OF_QUESTIONS) {
    const input = {
      repositoryId: payload.repository.node_id,
      title: `Request #${number} from ${author} (${current}/${total})`,
      body: [
        `Request: #${number} @${author}`,
        `Callback: ${cbNodeId}`,
      ].join("\n"),
      categoryId: categories.question,
    };
    return octokit.graphql(
      `mutation($input: CreateDiscussionInput!) {
      createDiscussion(input: $input) {
        discussion {
          number
        }
      }
    }`,
      { input },
    );
  }

  const { addDiscussionComment: { comment } } = await addComment();
  console.log(JSON.stringify(data, null, 2));

  const discussions = [];

  for (let i = 1; i <= NUMBER_OF_QUESTIONS; i++) {
    const { createDiscussion: { discussion } } = await ask(comment.id, i);
    discussions.push(discussion.number);
  }
  await updateComment(comment.id, discussions);
}

async function main() {
  const action = github.context.action;
  switch (action) {
    case "request":
      if (github.context.payload.discussion.comments !== 0) {
        core.setSkipped("Already commented");
      }
      await request();
      break;
    default:
      throw new Error(`Unknown type: ${action}`);
  }
}

try {
  await main();
} catch (error) {
  console.log(JSON.stringify(github.context.payload, null, 2));
  core.setFailed(error.message);
}
