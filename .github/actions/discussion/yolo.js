const core = require('@actions/core');
const github = require('@actions/github');

async function main() {
  const action = github.context.action;
  const payload = github.context.payload;

  core.info(`Action: ${action}`);
  core.info(`Payload: ${JSON.stringify(payload, null, 2)}`);
}

try {
  main();
} catch (error) {
  core.setFailed(error.message);
}
