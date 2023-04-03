// @ts-check

const core = require("@actions/core");
const github = require("@actions/github");

const categories = {
  request: "DIC_kwDOJJzAY84CVZ_1",
  question: "DIC_kwDOJJzAY84CVZ_2",
};

function getOctokit() {
  return github.getOctokit(core.getInput("token"));
}

async function request() {
  const octokit = getOctokit();
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

  /**
   * @param {string} commentId
   * @param {number[]} numbers
   * @returns {Promise<never>}
   */
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

  /**
   * @param {string} cbNodeId
   * @param {number} current
   * @param {number} total
   * @returns {Promise<{
   *   createDiscussion: { discussion: { number: number }}
   * }>}
   */
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
  const discussions = [];

  for (let i = 1; i <= NUMBER_OF_QUESTIONS; i++) {
    const { createDiscussion: { discussion } } = await ask(comment.id, i);
    discussions.push(discussion.number);
  }
  await updateComment(comment.id, discussions);
}

async function answer() {
  const octokit = getOctokit();
  const payload = github.context.payload;
  /** @type {string[]} */
  const bodyLines = payload.discussion.body.split("\n");
  const cbLine = bodyLines.find((line) => line.startsWith("Callback:"));
  if (!cbLine) {
    throw new Error("No callback line");
  }
  const cbNodeId = cbLine.split(":")[1].trim();

  /**
   * Mark the question as answered and close it.
   * @returns {Promise<never>}
   */
  function finalizeDiscussion() {
    const answerInput = {
      id: payload.comment.node_id,
    };
    const closeInput = {
      discussionId: payload.discussion.node_id,
      reason: "RESOLVED",
    };
    return octokit.graphql(
      `mutation(
        $answerInput: MarkDiscussionCommentAsAnswerInput!,
        $closeInput: CloseDiscussionInput!
      ) {
        markDiscussionCommentAsAnswer(input: $answerInput)
        closeDiscussion(input: $closeInput)
      }`,
      { answerInput, closeInput },
    );
  }

  /**
   * @returns {Promise<{
   *    node: { body: string }
   * }>}
   */
  function getCallbackComment() {
    // Get the body of the callback comment
    const queryInput = {
      id: cbNodeId,
    };
    return octokit.graphql(
      `query($queryInput: ID!) {
        node(id: $queryInput) {
          ... on DiscussionComment {
            body
          }
        }
      }`,
      { queryInput },
    );
  }

  /**
   * Update the callback comment with the answer.
   * @param {string[]} lines
   * @param {boolean} allSolved
   * @returns {Promise<never>}
   */
  function updateCallback(lines, allSolved) {
    const updateInput = {
      commentId: cbNodeId,
      body: [
        `@${payload.comment.user.login}`,
        ...lines,
      ].join("\n"),
    };

    // update and close the discussion if all questions have been answered
    if (allSolved) {
      updateInput.body += "\n\nAll questions have been answered!";
      const closeInput = {
        discussionId: payload.discussion.node_id,
        reason: "RESOLVED",
      };
      return octokit.graphql(
        `mutation(
          $updateInput: UpdateDiscussionCommentInput!,
          $closeInput: CloseDiscussionInput!
        ) {
          updateDiscussionComment(input: $updateInput)
          closeDiscussion(input: $closeInput)
        }`,
        { updateInput, closeInput },
      );
    }

    return octokit.graphql(
      `mutation($updateInput: UpdateDiscussionCommentInput!) {
        updateDiscussionComment(input: $updateInput)
      }`,
      { updateInput },
    );
  }

  await finalizeDiscussion();
  const { node: { body } } = await getCallbackComment();
  const lines = body.split("\n").slice(1);

  const questionNumber = payload.discussion.number;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes(`#${questionNumber}`)) {
      lines[i] = line.replace("[ ]", "[x]");
      break;
    }
  }

  await updateCallback(lines, lines.every((line) => line.includes("[x]")));
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
    case "answer":
      await answer();
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
