import { Handler } from "@netlify/functions";

import * as slack from "./slack";

const pickRandom = <T>(arr: T[]): T =>
	arr[Math.floor(Math.random() * arr.length)];

const messages = [
	":thinking_face: Just a hunch, but this might be a task for @user~",
	":knife_fork_plate: This one goes on your plate @user!",
	":drum_with_drumsticks: Drum roll... This one's for @user!",
	":shrug: I'm sorry, but you'll have to take care of it @user",
	":shrug: I'm sorry (I'm also a couple lines of code running off a serverless function so take it for what it's worth), but you're the person for the job @user",
];

const handler: Handler = async (event, _context) => {
	// Only handle POST requests
	if (event.httpMethod !== "POST") {
		return { statusCode: 400 };
	}

	// Only accept messages from Slack
	if (!slack.verify(event)) {
		return { statusCode: 401 };
	}

	// Don't answer to Slack retry attempts
	if (
		event.headers["x-slack-retry-num"] &&
		parseInt(event.headers["x-slack-retry-num"]) > 0
	) {
		return { statusCode: 200 };
	}

	// Extract body
	const body = slack.parseBody(event);

	// Return challenge if present
	if (body.challenge) {
		return {
			statusCode: 200,
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify(body.challenge),
		};
	}

	console.log(body);

	if (body.event.type === "app_mention" && !body.event.edited) {
		// Get conversations members
		let members: string[] = [];
		if (body.event.thread_ts) {
			members = (
				(await slack.get("/conversations.replies", {
					channel: body.event.channel,
					ts: body.event.thread_ts,
					limit: 1000,
				})) as { messages: { user: string }[] }
			).messages.map((m) => m.user);
		} else {
			members = (
				(await slack.get("/conversations.members", {
					channel: body.event.channel,
					limit: 100,
				})) as { members: string[] }
			).members;
		}

		// Filter bots if necessary
		if (process.env.SLACK_BOT_IDS) {
			const ids = process.env.SLACK_BOT_IDS.split(",");
			members = members.filter((id) => !ids.includes(id));
		}

		// Pick a random member and create answer
		const message = pickRandom(messages).replace(
			"@user",
			`<@${pickRandom(members)}>`,
		);

		// Send answer
		await slack.post("/chat.postMessage", {
			channel: body.event.channel,
			text: message,
			thread_ts: body.event.thread_ts,
		});
	}

	return { statusCode: 200 };
};

export { handler };
