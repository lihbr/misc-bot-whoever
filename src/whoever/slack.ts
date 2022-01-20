import crypto from "node:crypto";

import { HandlerEvent } from "@netlify/functions";
import fetch from "node-fetch";
import qs from "qs";

type Body = {
	challenge?: string;
	event: Record<string, string>;
};

export const verify = (event: HandlerEvent) => {
	// Validate event
	if (
		!event.headers["x-slack-request-timestamp"] ||
		!event.headers["x-slack-signature"]
	) {
		return false;
	}

	// Getting variables
	const ver = "v0";
	const timestamp = parseInt(event.headers["x-slack-request-timestamp"]);
	const body = event.body; // was rawBody

	// Deny if too old
	if (
		process.env.NODE_ENV === "production" &&
		Date.now() / 1000 - timestamp > 60 * 5
	) {
		return false;
	}

	// Hash body
	const basestring = `${ver}:${timestamp}:${body}`;
	const hmac = crypto.createHmac("sha256", process.env.SLACK_SIGNING_SECRET!);
	hmac.update(basestring);
	const signature = `${ver}=${hmac.digest("hex")}`;

	// Verify body match signature
	return signature === event.headers["x-slack-signature"];
};

export const get = async (
	endpoint: string,
	body?: unknown,
): Promise<unknown> => {
	const res = await fetch(
		`${process.env.SLACK_API}${endpoint}?${qs.stringify(body)}`,
		{
			headers: {
				"content-type": "application/x-www-form-urlencoded",
				authorization: `Bearer ${process.env.SLACK_BOT_OAUTH_TOKEN}`,
			},
			method: "GET",
		},
	);

	return await res.json();
};

export const post = async (
	endpoint: string,
	body?: unknown,
): Promise<unknown> => {
	const res = await fetch(`${process.env.SLACK_API}${endpoint}`, {
		headers: {
			"content-type": "application/json; charset=utf-8",
			authorization: `Bearer ${process.env.SLACK_BOT_OAUTH_TOKEN}`,
		},
		method: "POST",
		body: JSON.stringify(body),
	});

	return res.json();
};

export const parseBody = (event: HandlerEvent): Body => {
	if (!event.body) {
		throw new Error("body has no event");
	}
	if (event.headers["content-type"] === "application/json") {
		return JSON.parse(event.body);
	} else {
		const body = qs.parse(event.body) as Body | { payload: string };

		return "payload" in body ? JSON.parse(body.payload) : body;
	}
};
