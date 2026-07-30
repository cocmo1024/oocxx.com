export default {
	async fetch(request, env) {
		const url = new URL(request.url);

		if (url.protocol !== "https:" || url.hostname === "www.oocxx.com") {
			url.protocol = "https:";
			url.hostname = "oocxx.com";
			return Response.redirect(url.toString(), 301);
		}

		const response = await env.ASSETS.fetch(request);
		const headers = new Headers(response.headers);

		headers.set("X-Content-Type-Options", "nosniff");
		headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

		if (url.pathname === "/index.json") {
			headers.set("X-Robots-Tag", "noindex, nofollow");
		}

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	},
};
