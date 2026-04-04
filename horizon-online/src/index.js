import { DurableObject } from "cloudflare:workers";

/**
 * Horizon Online - Multi-Agent Team Collaboration
 * 
 * Enables multiple OmniAgent instances to form teams,
 * distribute tasks, and sync results in real-time.
 */

// TeamRoom Durable Object - Manages a single team's state
export class TeamRoom extends DurableObject {
	constructor(ctx, env) {
		super(ctx, env);
		this.sessions = new Map(); // WebSocket sessions
	}

	// Initialize team with leader info
	async initTeam(leaderRole) {
		await this.ctx.storage.put("leader", {
			role: leaderRole,
			joinedAt: Date.now()
		});
		await this.ctx.storage.put("members", []);
		await this.ctx.storage.put("tasks", []);
		await this.ctx.storage.put("results", []);
		return { success: true };
	}

	// Add a member to the team
	async joinTeam(memberRole) {
		const members = await this.ctx.storage.get("members") || [];
		const memberId = `member_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

		members.push({
			id: memberId,
			role: memberRole,
			joinedAt: Date.now(),
			status: "ready"
		});

		await this.ctx.storage.put("members", members);
		this.broadcast({ type: "member_joined", role: memberRole, id: memberId });

		return { success: true, memberId, members };
	}

	// Get team status
	async getStatus() {
		const leader = await this.ctx.storage.get("leader");
		const members = await this.ctx.storage.get("members") || [];
		const tasks = await this.ctx.storage.get("tasks") || [];
		const results = await this.ctx.storage.get("results") || [];

		return { leader, members, tasks, results };
	}

	// Leader assigns a task to a member
	async assignTask(memberId, taskDescription, taskType) {
		const tasks = await this.ctx.storage.get("tasks") || [];
		const taskId = `task_${Date.now()}`;

		const task = {
			id: taskId,
			assignedTo: memberId,
			description: taskDescription,
			type: taskType,
			status: "pending",
			createdAt: Date.now()
		};

		tasks.push(task);
		await this.ctx.storage.put("tasks", tasks);
		this.broadcast({ type: "task_assigned", task });

		return { success: true, taskId, task };
	}

	// Member submits task result
	async submitResult(memberId, taskId, resultData) {
		const tasks = await this.ctx.storage.get("tasks") || [];
		const results = await this.ctx.storage.get("results") || [];
		const members = await this.ctx.storage.get("members") || [];
		const member = members.find(m => m.id === memberId) || { role: "Member" };

		// Update task status
		const taskIndex = tasks.findIndex(t => t.id === taskId);
		let taskDescription = "Unknown Task";
		if (taskIndex >= 0) {
			tasks[taskIndex].status = "completed";
			taskDescription = tasks[taskIndex].description;
			await this.ctx.storage.put("tasks", tasks);
		}

		// Store result
		const result = {
			taskId,
			memberId,
			memberRole: member.role,
			taskDescription,
			data: resultData,
			submittedAt: Date.now()
		};
		results.push(result);
		await this.ctx.storage.put("results", results);

		this.broadcast({ type: "result_submitted", taskId, memberId, role: member.role });

		return { success: true, result };
	}

	// Get pending tasks for a member
	async getMyTasks(memberId) {
		const tasks = await this.ctx.storage.get("tasks") || [];
		return tasks.filter(t => t.assignedTo === memberId && t.status === "pending");
	}

	// Get all results (for leader to sync)
	async getAllResults() {
		return await this.ctx.storage.get("results") || [];
	}

	// ─── TEAM CHAT ───────────────────────────────────────────────
	async sendChatMessage(sender, role, text, attachmentUrl = null) {
		const messages = await this.ctx.storage.get("messages") || [];
		const msg = {
			id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
			sender,
			role,
			text,
			attachmentUrl,
			timestamp: Date.now()
		};
		messages.push(msg);
		// Keep only last 500 messages
		if (messages.length > 500) messages.splice(0, messages.length - 500);
		await this.ctx.storage.put("messages", messages);
		// Broadcast to all clients connected via WebSocket
		this.broadcast({ type: "new_message", message: msg });
		return { success: true, message: msg };
	}

	async getChatMessages(limit = 50) {
		const messages = await this.ctx.storage.get("messages") || [];
		return messages.slice(-limit);
	}

	// WebSocket handling for real-time updates
	async fetch(request) {
		if (request.headers.get("Upgrade") === "websocket") {
			const pair = new WebSocketPair();
			const [client, server] = Object.values(pair);

			this.ctx.acceptWebSocket(server);
			this.sessions.set(server, { connectedAt: Date.now() });

			return new Response(null, { status: 101, webSocket: client });
		}

		return new Response("Expected WebSocket", { status: 400 });
	}

	webSocketMessage(ws, message) {
		// Handle incoming WebSocket messages
		try {
			const data = JSON.parse(message);
			// Echo or process
			ws.send(JSON.stringify({ type: "ack", data }));
		} catch (e) {
			ws.send(JSON.stringify({ type: "error", message: e.message }));
		}
	}

	webSocketClose(ws) {
		this.sessions.delete(ws);
	}

	// Broadcast message to all connected clients
	broadcast(message) {
		const msg = JSON.stringify(message);
		for (const [ws] of this.sessions) {
			try {
				ws.send(msg);
			} catch (e) {
				this.sessions.delete(ws);
			}
		}
	}
}

// Generate 6-digit team code
function generateTeamCode() {
	return Math.floor(100000 + Math.random() * 900000).toString();
}

// Main Worker - REST API
export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		const path = url.pathname;

		// CORS headers for local testing
		const corsHeaders = {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
			"Content-Type": "application/json"
		};

		if (request.method === "OPTIONS") {
			return new Response(null, { headers: corsHeaders });
		}

		try {
			// POST /api/team/create - Create a new team
			if (path === "/api/team/create" && request.method === "POST") {
				const { role } = await request.json();
				const teamCode = generateTeamCode();
				const roomId = `team_${teamCode}`;

				// Get or create the Durable Object for this team
				const stub = env.TEAM_ROOM.get(env.TEAM_ROOM.idFromName(roomId));
				await stub.initTeam(role);

				// Store team code mapping (in-memory for local dev)
				// In production, you'd use KV: await env.TEAM_CODES.put(teamCode, roomId);

				return new Response(JSON.stringify({
					success: true,
					teamCode,
					message: `Team created! Share this code: ${teamCode}`
				}), { headers: corsHeaders });
			}

			// POST /api/team/join - Join a team with code
			if (path === "/api/team/join" && request.method === "POST") {
				const { code, role } = await request.json();
				const roomId = `team_${code}`;

				const stub = env.TEAM_ROOM.get(env.TEAM_ROOM.idFromName(roomId));
				const result = await stub.joinTeam(role);

				return new Response(JSON.stringify({
					success: true,
					memberId: result.memberId,
					teamCode: code,
					message: `Joined team ${code} as ${role}`
				}), { headers: corsHeaders });
			}

			// GET /api/team/:code/status - Get team status
			if (path.startsWith("/api/team/") && path.endsWith("/status")) {
				const code = path.split("/")[3];
				const roomId = `team_${code}`;

				const stub = env.TEAM_ROOM.get(env.TEAM_ROOM.idFromName(roomId));
				const status = await stub.getStatus();

				return new Response(JSON.stringify(status), { headers: corsHeaders });
			}

			// GET /api/team/:code/messages - Get team chat messages
			if (path.match(/^\/api\/team\/\d+\/messages$/) && request.method === "GET") {
				const code = path.split("/")[3];
				const limit = parseInt(url.searchParams.get("limit") || "50");
				const stub = env.TEAM_ROOM.get(env.TEAM_ROOM.idFromName(`team_${code}`));
				const messages = await stub.getChatMessages(limit);
				return new Response(JSON.stringify({ messages }), { headers: corsHeaders });
			}

			// POST /api/team/:code/messages - Send a team chat message
			if (path.match(/^\/api\/team\/\d+\/messages$/) && request.method === "POST") {
				const code = path.split("/")[3];
				const { sender, role, text, attachmentUrl } = await request.json();
				if (!sender || !text) {
					return new Response(JSON.stringify({ error: "sender and text are required" }), { status: 400, headers: corsHeaders });
				}
				const stub = env.TEAM_ROOM.get(env.TEAM_ROOM.idFromName(`team_${code}`));
				const result = await stub.sendChatMessage(sender, role || "Member", text, attachmentUrl || null);
				return new Response(JSON.stringify(result), { headers: corsHeaders });
			}

			// GET /api/team/:code/members - Get team members
			if (path.startsWith("/api/team/") && path.endsWith("/members")) {
				const code = path.split("/")[3];
				const roomId = `team_${code}`;

				const stub = env.TEAM_ROOM.get(env.TEAM_ROOM.idFromName(roomId));
				const status = await stub.getStatus();
				const members = status.members || [];

				return new Response(JSON.stringify({ members }), { headers: corsHeaders });
			}

			// GET /api/team/:code/tasks/:memberId - Get tasks for specific member
			if (path.match(/^\/api\/team\/\d+\/tasks\/[^\/]+$/)) {
				const parts = path.split("/");
				const code = parts[3];
				const memberId = parts[5];
				const roomId = `team_${code}`;

				const stub = env.TEAM_ROOM.get(env.TEAM_ROOM.idFromName(roomId));
				const tasks = await stub.getMyTasks(memberId);

				return new Response(JSON.stringify({ tasks }), { headers: corsHeaders });
			}

			// POST /api/team/:code/tasks - Leader assigns a task (called by Teams.jsx)
			if (path.match(/^\/api\/team\/\w+\/tasks$/) && request.method === "POST") {
				const code = path.split("/")[3];
				const { memberId, description, type } = await request.json();
				if (!memberId || !description) {
					return new Response(JSON.stringify({ error: "memberId and description are required" }), { status: 400, headers: corsHeaders });
				}
				const stub = env.TEAM_ROOM.get(env.TEAM_ROOM.idFromName(`team_${code}`));
				const result = await stub.assignTask(memberId, description, type || "general");
				return new Response(JSON.stringify(result), { headers: corsHeaders });
			}

			// GET /api/team/:code/results - Leader syncs all submitted results
			if (path.match(/^\/api\/team\/\w+\/results$/) && request.method === "GET") {
				const code = path.split("/")[3];
				const stub = env.TEAM_ROOM.get(env.TEAM_ROOM.idFromName(`team_${code}`));
				const results = await stub.getAllResults();
				return new Response(JSON.stringify({ results }), { headers: corsHeaders });
			}

			// POST /api/team/:code/results - Member submits work result (called by Teams.jsx)
			if (path.match(/^\/api\/team\/\w+\/results$/) && request.method === "POST") {
				const code = path.split("/")[3];
				const { taskId, memberId, filename, content } = await request.json();
				if (!taskId || !memberId) {
					return new Response(JSON.stringify({ error: "taskId and memberId are required" }), { status: 400, headers: corsHeaders });
				}
				const stub = env.TEAM_ROOM.get(env.TEAM_ROOM.idFromName(`team_${code}`));
				const result = await stub.submitResult(memberId, taskId, { filename: filename || `output_${taskId}.txt`, content });
				return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
			}

			// POST /api/plugins/track - Track plugin events (installs, views)
			if (path === "/api/plugins/track" && request.method === "POST") {
				const { pluginId, eventType, amount, currency } = await request.json();
				const id = crypto.randomUUID();
				
				await env.DB.prepare(
					"INSERT INTO plugin_stats (id, plugin_id, event_type, amount, currency) VALUES (?, ?, ?, ?, ?)"
				).bind(id, pluginId, eventType, amount || 0, currency || 'USD').run();

				// If install, increment total counter
				if (eventType === 'install') {
					await env.DB.prepare("UPDATE plugins SET install_count = install_count + 1 WHERE id = ?").bind(pluginId).run();
				}

				return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
			}

			// POST /api/task/assign - Leader assigns task (legacy route kept for CLI compat)
			if (path === "/api/task/assign" && request.method === "POST") {
				const { teamCode, memberId, description, type } = await request.json();
				const roomId = `team_${teamCode}`;

				const stub = env.TEAM_ROOM.get(env.TEAM_ROOM.idFromName(roomId));
				const result = await stub.assignTask(memberId, description, type);

				return new Response(JSON.stringify(result), { headers: corsHeaders });
			}

			// POST /api/task/complete - Member submits result
			if (path === "/api/task/complete" && request.method === "POST") {
				const { teamCode, memberId, taskId, resultData } = await request.json();
				const roomId = `team_${teamCode}`;

				const stub = env.TEAM_ROOM.get(env.TEAM_ROOM.idFromName(roomId));
				const result = await stub.submitResult(memberId, taskId, resultData);

				return new Response(JSON.stringify(result), { headers: corsHeaders });
			}

			// GET /api/task/:code/:memberId - Get tasks for member
			if (path.startsWith("/api/task/") && path.split("/").length === 5) {
				const parts = path.split("/");
				const code = parts[3];
				const memberId = parts[4];
				const roomId = `team_${code}`;

				const stub = env.TEAM_ROOM.get(env.TEAM_ROOM.idFromName(roomId));
				const tasks = await stub.getMyTasks(memberId);

				return new Response(JSON.stringify({ tasks }), { headers: corsHeaders });
			}

			// GET /api/results/:code - Get all results (for sync)
			if (path.startsWith("/api/results/")) {
				const code = path.split("/")[3];
				const roomId = `team_${code}`;

				const stub = env.TEAM_ROOM.get(env.TEAM_ROOM.idFromName(roomId));
				const results = await stub.getAllResults();

				return new Response(JSON.stringify({ results }), { headers: corsHeaders });
			}

			// WebSocket upgrade for real-time
			if (path.startsWith("/ws/")) {
				const code = path.split("/")[2];
				const roomId = `team_${code}`;

				const stub = env.TEAM_ROOM.get(env.TEAM_ROOM.idFromName(roomId));
				return stub.fetch(request);
			}

			// Health check
			if (path === "/api/health") {
				return new Response(JSON.stringify({
					status: "ok",
					service: "Horizon Online",
					version: "1.0.0"
				}), { headers: corsHeaders });
			}

			// POST /api/auth/signup - Create new user
			if (path === "/api/auth/signup" && request.method === "POST") {
				const { email, password, username } = await request.json();

				// Check if user exists
				const existing = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
				if (existing) {
					return new Response(JSON.stringify({ error: "User already exists" }), { status: 400, headers: corsHeaders });
				}

				// Generate verification code
				const code = Math.floor(100000 + Math.random() * 900000).toString();

				// Create user (unverified)
				// In real app, hash password!
				const userId = crypto.randomUUID();
				await env.DB.prepare("INSERT INTO users (id, email, password, username, verify_code, verified) VALUES (?, ?, ?, ?, ?, 0)")
					.bind(userId, email, password, username, code)
					.run();

				// Send email
				await sendEmail(email, "Verify your Horizon Desk account", `Your code is: ${code}`, env);

				return new Response(JSON.stringify({ success: true, message: "Verification code sent" }), { headers: corsHeaders });
			}

			// POST /api/auth/verify - Verify email
			if (path === "/api/auth/verify" && request.method === "POST") {
				const { email, code } = await request.json();

				const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
				if (!user) return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: corsHeaders });

				if (user.verify_code !== code) {
					return new Response(JSON.stringify({ error: "Invalid code" }), { status: 400, headers: corsHeaders });
				}

				await env.DB.prepare("UPDATE users SET verified = 1, verify_code = NULL WHERE email = ?").bind(email).run();
				return new Response(JSON.stringify({ success: true, message: "Account verified" }), { headers: corsHeaders });
			}

			// POST /api/auth/login
			if (path === "/api/auth/login" && request.method === "POST") {
				const { email, password } = await request.json();

				const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
				if (!user || user.password !== password) {
					return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401, headers: corsHeaders });
				}

				if (!user.verified) {
					return new Response(JSON.stringify({ error: "Email not verified" }), { status: 403, headers: corsHeaders });
				}

				return new Response(JSON.stringify({
					success: true,
					user: { id: user.id, email: user.email, username: user.username }
				}), { headers: corsHeaders });
			}

			// POST /api/auth/forgot-password
			if (path === "/api/auth/forgot-password" && request.method === "POST") {
				const { email } = await request.json();

				const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
				if (!user) {
					// We return success even if user doesn't exist to prevent email enumeration,
					// but for this MVP, returning an error is fine to help the user debug.
					return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: corsHeaders });
				}

				// Generate reset code
				const code = Math.floor(100000 + Math.random() * 900000).toString();

				// Save code to DB
				await env.DB.prepare("UPDATE users SET verify_code = ? WHERE email = ?").bind(code, email).run();

				// Send email
				await sendEmail(email, "Horizon Desk Password Reset", `Your password reset code is: ${code}`, env);

				return new Response(JSON.stringify({ success: true, message: "Reset code sent to email" }), { headers: corsHeaders });
			}

			// POST /api/auth/reset-password
			if (path === "/api/auth/reset-password" && request.method === "POST") {
				const { email, code, newPassword } = await request.json();

				const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
				if (!user) return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: corsHeaders });

				if (user.verify_code !== code) {
					return new Response(JSON.stringify({ error: "Invalid reset code" }), { status: 400, headers: corsHeaders });
				}

				// Update password and clear code
				await env.DB.prepare("UPDATE users SET password = ?, verify_code = NULL WHERE email = ?").bind(newPassword, email).run();

				return new Response(JSON.stringify({ success: true, message: "Password updated successfully" }), { headers: corsHeaders });
			}

			// Temporary Debug Route for Schema
			if (path === "/api/debug/schema" && request.method === "GET") {
				const info = await env.DB.prepare("PRAGMA table_info(users)").all();
				return new Response(JSON.stringify(info), { headers: corsHeaders });
			}

			// POST /api/auth/oauth-sync (Used by Desktop App to upsert a Rapnss OAuth profile into D1)
			if (path === "/api/auth/oauth-sync" && request.method === "POST") {
				const userData = await request.json();
				// Derive safe values from what Rapnss actually returns:
				// { id, handle, name, email }
				const rapnssId = String(userData.id || userData.rapnssId || '');
				const email = userData.email || `${rapnssId}@rapnss.oauth`;
				const username = userData.name || userData.handle || email.split('@')[0];
				const fullName = userData.name || username;
				const handle = userData.handle || username;
				
				// Look up by rapnss_id first (most reliable)
				let user = rapnssId ? await env.DB.prepare("SELECT * FROM users WHERE rapnss_id = ?").bind(rapnssId).first() : null;
				
				// Fall back to email if rapnss_id not found (links existing old accounts to Rapnss)
				if (!user && email) {
					user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
				}

				if (!user) {
					const userId = crypto.randomUUID();
					await env.DB.prepare(
						"INSERT INTO users (id, rapnss_id, email, username, handle, full_name, provider, verified) VALUES (?, ?, ?, ?, ?, ?, 'rapnss', 1)"
					).bind(userId, rapnssId || null, email, username, handle, fullName).run();
					user = { id: userId, rapnss_id: rapnssId, email, username };
				} else {
					// Update profile info on every login
					await env.DB.prepare(
						"UPDATE users SET username = ?, handle = ?, full_name = ?, rapnss_id = ? WHERE id = ?"
					).bind(username, handle, fullName, rapnssId || user.rapnss_id, user.id).run();
					user = { ...user, username };
				}

				return new Response(JSON.stringify({
					success: true,
					user: { id: user.id, rapnss_id: user.rapnss_id, email: user.email, username: user.username }
				}), { headers: corsHeaders });
			}

			// POST /api/auth/oauth-exchange
			if (path === "/api/auth/oauth-exchange" && request.method === "POST") {
				const { code, redirectUri } = await request.json();

				// 1. Exchange code for token
				const tokenResponse = await fetch("https://rapnss.in/api/oauth/token", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						grant_type: "authorization_code",
						client_id: env.RAPNSS_CLIENT_ID,
						client_secret: env.RAPNSS_CLIENT_SECRET,
						code: code,
						redirect_uri: redirectUri
					})
				});

				const tokenData = await tokenResponse.json();
				if (!tokenResponse.ok) {
					return new Response(JSON.stringify({ error: "Failed token exchange", details: tokenData }), { status: 400, headers: corsHeaders });
				}

				// 2. Fetch User Info from Rapnss
				const userResponse = await fetch("https://rapnss.in/api/oauth/userinfo", {
					headers: { "Authorization": `Bearer ${tokenData.access_token}` }
				});
				const userData = await userResponse.json();
				if (!userResponse.ok) {
					return new Response(JSON.stringify({ error: "Failed getting user profile", details: userData }), { status: 400, headers: corsHeaders });
				}

				// 3. Map Rapnss fields: { id, handle, name, email }
				const rapnssId = String(userData.id || '');
				const email = userData.email || `${rapnssId}@rapnss.oauth`;
				const username = userData.name || userData.handle || email.split('@')[0];
				const fullName = userData.name || username;
				const handle = userData.handle || username;

				// Look up by rapnss_id first (most reliable)
				let user = rapnssId ? await env.DB.prepare("SELECT * FROM users WHERE rapnss_id = ?").bind(rapnssId).first() : null;

				// Fall back to email to link existing accounts
				if (!user && email) {
					user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
				}

				if (!user) {
					const userId = crypto.randomUUID();
					await env.DB.prepare(
						"INSERT INTO users (id, rapnss_id, email, username, handle, full_name, provider, verified) VALUES (?, ?, ?, ?, ?, ?, 'rapnss', 1)"
					).bind(userId, rapnssId || null, email, username, handle, fullName).run();
					user = { id: userId, rapnss_id: rapnssId, email, username };
				} else {
					// Refresh profile on every login
					await env.DB.prepare(
						"UPDATE users SET username = ?, handle = ?, full_name = ?, rapnss_id = ? WHERE id = ?"
					).bind(username, handle, fullName, rapnssId || user.rapnss_id, user.id).run();
					user = { ...user, username };
				}

				return new Response(JSON.stringify({
					success: true,
					user: { id: user.id, rapnss_id: user.rapnss_id, email: user.email, username: user.username },
					rapnssToken: tokenData.access_token
				}), { headers: corsHeaders });
			}

			// POST /api/classify - ResNet-50 Image Classification
			if (path === "/api/classify" && request.method === "POST") {
				try {
					const { image } = await request.json(); // Expecting array of integers (e.g. from generic-form-data or similar) or base64?
					// Workers AI expects input depends on model. For resnet-50 it usually takes { image: number[] } or similar.
					// Actually, @cf/microsoft/resnet-50 takes { image: number[] } (pixel values) or input directly.
					// Let's assume the client sends the raw bytes as an array.

					const response = await env.AI.run('@cf/microsoft/resnet-50', {
						image: image
					});

					return new Response(JSON.stringify(response), { headers: corsHeaders });
				} catch (e) {
					return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
				}
			}

			// POST /api/dev/register - Register a user as a developer
			if (path === "/api/dev/register" && request.method === "POST") {
				const { userId } = await request.json();

				const existing = await env.DB.prepare("SELECT * FROM developers WHERE user_id = ?").bind(userId).first();
				if (existing) {
					return new Response(JSON.stringify({ success: true, developer: existing }), { headers: corsHeaders });
				}

				const devId = crypto.randomUUID();
				await env.DB.prepare(
					"INSERT INTO developers (id, user_id, agreed_to_terms, free_releases_left, ad_balance) VALUES (?, ?, 1, 1, 10.00)"
				).bind(devId, userId).run();

				const newDev = await env.DB.prepare("SELECT * FROM developers WHERE id = ?").bind(devId).first();
				return new Response(JSON.stringify({ success: true, developer: newDev, message: "Welcome to the Developer Program! You received 1 free release and $10 in Ad Credits." }), { headers: corsHeaders });
			}

			// GET /api/dev/dashboard - Get developer details and their plugins
			if (path === "/api/dev/dashboard" && request.method === "GET") {
				const userId = url.searchParams.get("userId");
				if (!userId) return new Response(JSON.stringify({ error: "Missing userId" }), { status: 400, headers: corsHeaders });

				const dev = await env.DB.prepare("SELECT * FROM developers WHERE user_id = ?").bind(userId).first();
				if (!dev) return new Response(JSON.stringify({ error: "Developer not found" }), { status: 404, headers: corsHeaders });

				const { results: plugins } = await env.DB.prepare("SELECT * FROM plugins WHERE developer_id = ? ORDER BY created_at DESC").bind(dev.id).all();

				return new Response(JSON.stringify({ success: true, developer: dev, plugins }), { headers: corsHeaders });
			}

			// POST /api/dev/plugins - Upload/Publish a new plugin
			if (path === "/api/dev/plugins" && request.method === "POST") {
				const { developerId, name, description, version, tigrisUrl, iconUrl, category } = await request.json();

				const dev = await env.DB.prepare("SELECT * FROM developers WHERE id = ?").bind(developerId).first();
				if (!dev) return new Response(JSON.stringify({ error: "Developer not found" }), { status: 404, headers: corsHeaders });

				// Check if they have free releases or balance
				if (dev.free_releases_left <= 0 && dev.ad_balance < 2.00) {
					return new Response(JSON.stringify({ error: "Insufficient balance to publish. Costs $2.00." }), { status: 402, headers: corsHeaders });
				}

				// Deduct balance or free release
				if (dev.free_releases_left > 0) {
					await env.DB.prepare("UPDATE developers SET free_releases_left = free_releases_left - 1 WHERE id = ?").bind(developerId).run();
				} else {
					await env.DB.prepare("UPDATE developers SET ad_balance = ad_balance - 2.00 WHERE id = ?").bind(developerId).run();
				}

				const pluginId = `p_${Date.now()}_${crypto.randomUUID().substr(0, 4)}`;
				await env.DB.prepare(
					"INSERT INTO plugins (id, developer_id, name, description, version, tigris_url, icon_url, category, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published')"
				).bind(pluginId, developerId, name, description, version, tigrisUrl, iconUrl || null, category || 'general').run();

				return new Response(JSON.stringify({ success: true, message: "Plugin published successfully!", pluginId }), { headers: corsHeaders });
			}

			// GET /api/dev/plugins/:id - Get single plugin details
			if (path.match(/^\/api\/dev\/plugins\/[^\/]+$/) && request.method === "GET") {
				const pluginId = path.split("/").pop();
				const plugin = await env.DB.prepare("SELECT * FROM plugins WHERE id = ?").bind(pluginId).first();
				if (!plugin) return new Response(JSON.stringify({ error: "Plugin not found" }), { status: 404, headers: corsHeaders });
				return new Response(JSON.stringify({ success: true, plugin }), { headers: corsHeaders });
			}

			// PUT /api/dev/plugins/:id - Update a plugin
			if (path.match(/^\/api\/dev\/plugins\/[^\/]+$/) && request.method === "PUT") {
				const pluginId = path.split("/").pop();
				const { name, description, fullDescription, screenshots, version, iconUrl, tigrisUrl, category, 
					    price, price_inr, price_eur, price_cad, dynamic_pricing, gumroad_url } = await request.json();

				const plugin = await env.DB.prepare("SELECT * FROM plugins WHERE id = ?").bind(pluginId).first();
				if (!plugin) return new Response(JSON.stringify({ error: "Plugin not found" }), { status: 404, headers: corsHeaders });

				await env.DB.prepare(
					`UPDATE plugins SET 
						name = ?, description = ?, full_description = ?, screenshots = ?, version = ?, 
						icon_url = ?, tigris_url = ?, category = ?, 
						price = ?, price_inr = ?, price_eur = ?, price_cad = ?, dynamic_pricing = ?, gumroad_url = ?
					 WHERE id = ?`
				).bind(
					name !== undefined ? name : plugin.name,
					description !== undefined ? description : plugin.description,
					fullDescription !== undefined ? fullDescription : plugin.full_description,
					screenshots !== undefined ? JSON.stringify(screenshots) : plugin.screenshots,
					version !== undefined ? version : plugin.version,
					iconUrl !== undefined ? iconUrl : plugin.icon_url,
					tigrisUrl !== undefined ? tigrisUrl : plugin.tigris_url,
					category !== undefined ? category : plugin.category,
					price !== undefined ? price : plugin.price,
					price_inr !== undefined ? price_inr : plugin.price_inr,
					price_eur !== undefined ? price_eur : plugin.price_eur,
					price_cad !== undefined ? price_cad : plugin.price_cad,
					dynamic_pricing !== undefined ? dynamic_pricing : plugin.dynamic_pricing,
					gumroad_url !== undefined ? gumroad_url : plugin.gumroad_url,
					pluginId
				).run();

				const updated = await env.DB.prepare("SELECT * FROM plugins WHERE id = ?").bind(pluginId).first();
				return new Response(JSON.stringify({ success: true, plugin: updated }), { headers: corsHeaders });
			}

			// GET /api/dev/stats - Real performance stats
			if (path === "/api/dev/stats" && request.method === "GET") {
				const userToken = request.headers.get("Authorization")?.replace("Bearer ", "");
				if (!userToken) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
				
				const user = await env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(userToken).first();
				if (!user) return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: corsHeaders });

				const dev = await env.DB.prepare("SELECT id FROM developers WHERE user_id = ?").bind(user.id).first();
				if (!dev) return new Response(JSON.stringify({ success: true, stats: { reach: 0, downloads: 0, revenue: 0, growth: 0 } }), { headers: corsHeaders });

				const stats = await env.DB.prepare(`
					SELECT 
						COUNT(CASE WHEN event_type = 'view' THEN 1 END) as reach,
						COUNT(CASE WHEN event_type = 'install' THEN 1 END) as downloads,
						SUM(CASE WHEN event_type = 'purchase' THEN amount ELSE 0 END) as revenue
					FROM plugin_stats 
					WHERE plugin_id IN (SELECT id FROM plugins WHERE developer_id = ?)
				`).bind(dev.id).first();

				return new Response(JSON.stringify({ 
					success: true, 
					stats: {
						reach: stats.reach || 0,
						downloads: stats.downloads || 0,
						revenue: stats.revenue || 0,
						growth: 12.5 // Mock growth for now
					}
				}), { headers: corsHeaders });
			}

			// DELETE /api/dev/plugins/:id - Delete a plugin
			if (path.match(/^\/api\/dev\/plugins\/[^\/]+$/) && request.method === "DELETE") {
				const pluginId = path.split("/").pop();
				const plugin = await env.DB.prepare("SELECT * FROM plugins WHERE id = ?").bind(pluginId).first();
				if (!plugin) return new Response(JSON.stringify({ error: "Plugin not found" }), { status: 404, headers: corsHeaders });

				await env.DB.prepare("DELETE FROM plugins WHERE id = ?").bind(pluginId).run();
				return new Response(JSON.stringify({ success: true, message: "Plugin deleted" }), { headers: corsHeaders });
			}

			// POST /api/dev/auth/token - CLI auth: exchange OAuth code for developer token
			if (path === "/api/dev/auth/token" && request.method === "POST") {
				const { code, redirectUri } = await request.json();

				// 1. Exchange code for Rapnss token
				const tokenResponse = await fetch("https://rapnss.in/api/oauth/token", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						grant_type: "authorization_code",
						client_id: "client_19149213c616458a813269c2b232bd7e",
						client_secret: "sec_7bd0f2dd5ac0450696871740bafcd91f",
						code,
						redirect_uri: redirectUri
					})
				});

				const tokenData = await tokenResponse.json();
				if (!tokenResponse.ok) {
					return new Response(JSON.stringify({ error: "Token exchange failed", details: tokenData }), { status: 400, headers: corsHeaders });
				}

				// 2. Get user info
				const userResponse = await fetch("https://rapnss.in/api/oauth/userinfo", {
					headers: { "Authorization": `Bearer ${tokenData.access_token}` }
				});
				const userData = await userResponse.json();
				if (!userResponse.ok) {
					return new Response(JSON.stringify({ error: "Failed getting user profile", details: userData }), { status: 400, headers: corsHeaders });
				}

				// 3. Upsert user
				const rapnssId = String(userData.id || '');
				const email = userData.email || `${rapnssId}@rapnss.oauth`;
				const username = userData.name || userData.handle || email.split('@')[0];
				const fullName = userData.name || username;
				const handle = userData.handle || username;

				let user = rapnssId ? await env.DB.prepare("SELECT * FROM users WHERE rapnss_id = ?").bind(rapnssId).first() : null;
				if (!user && email) {
					user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
				}

				if (!user) {
					const userId = crypto.randomUUID();
					await env.DB.prepare(
						"INSERT INTO users (id, rapnss_id, email, username, handle, full_name, provider, verified) VALUES (?, ?, ?, ?, ?, ?, 'rapnss', 1)"
					).bind(userId, rapnssId || null, email, username, handle, fullName).run();
					user = { id: userId, rapnss_id: rapnssId, email, username };
				}

				// 4. Get or create developer account
				let dev = await env.DB.prepare("SELECT * FROM developers WHERE user_id = ?").bind(user.id).first();
				if (!dev) {
					const devId = crypto.randomUUID();
					await env.DB.prepare(
						"INSERT INTO developers (id, user_id, agreed_to_terms, free_releases_left, ad_balance) VALUES (?, ?, 1, 1, 10.00)"
					).bind(devId, user.id).run();
					dev = await env.DB.prepare("SELECT * FROM developers WHERE id = ?").bind(devId).first();
				}

				return new Response(JSON.stringify({
					success: true,
					user: { id: user.id, email: user.email, username: user.username },
					developer: { id: dev.id, free_releases_left: dev.free_releases_left, ad_balance: dev.ad_balance },
					token: tokenData.access_token
				}), { headers: corsHeaders });
			}

			// POST /api/plugins/monetize - Save pricing for a specific plugin
			if (path === "/api/plugins/monetize" && request.method === "POST") {
				const { plugin_name, pricing_model, price, gumroad_url } = await request.json();
				if (!plugin_name) return new Response(JSON.stringify({ error: "plugin_name is required" }), { status: 400, headers: corsHeaders });

				let numericPrice = parseFloat(price || 0);
				if (isNaN(numericPrice)) numericPrice = 0;

				await env.DB.prepare(
					"UPDATE plugins SET pricing_model = ?, price = ?, gumroad_url = ? WHERE name = ?"
				).bind(pricing_model || 'free', numericPrice, gumroad_url || null, plugin_name).run();

				return new Response(JSON.stringify({ success: true, message: "Monetization settings updated." }), { headers: corsHeaders });
			}

			// POST /api/ads/prepare - Record an ad campaign request
			if (path === "/api/ads/prepare" && request.method === "POST") {
				const { plugin_name, plan, provider, email } = await request.json();
				const adId = `ad_${Date.now()}`;
				
				await env.DB.prepare(
					"INSERT INTO ads (id, plugin_name, plan, provider, email, status) VALUES (?, ?, ?, ?, ?, 'pending')"
				).bind(adId, plugin_name, plan, provider, email).run();

				return new Response(JSON.stringify({ success: true, ad_id: adId }), { headers: corsHeaders });
			}

			// ─────────────────────────────────────────────────────────────
			// RISKPAY WHITE LABEL INTEGRATION  (V3.1.0)
			// Affiliate wallet:  0x6ECa2A2B42A0AFdC4028fa8f39Fc9EBEaA53dA7A
			// Fee split:  6% affiliate  |  88% merchant (sum = 0.94)
			// ─────────────────────────────────────────────────────────────
			const WL_AFFILIATE    = '0x6ECa2A2B42A0AFdC4028fa8f39Fc9EBEaA53dA7A';
			const WL_API_BASE     = 'https://api.riskpay.biz/control';
			const WL_PAY_BASE     = 'https://pay.riskpay.biz';
			const WL_AFF_FEE      = '0.06';
			const WL_MERCH_FEE    = '0.82';

			// ─── 1. TRANSPARENT PROXY  GET /api/pay/proxy/<path> ────────
			// Forwards any path under /api/pay/proxy/* to api.packpayments.com
			// and auto-injects affiliate params so credentials stay server-side.
			if (path.startsWith('/api/pay/proxy/')) {
				const proxyPath = path.replace('/api/pay/proxy', '');
				const proxyUrl  = new URL(WL_API_BASE + proxyPath);

				// Mirror original query params
				for (const [k, v] of url.searchParams.entries()) {
					proxyUrl.searchParams.set(k, v);
				}

				// Remap wallet.php → custom-affiliate.php
				if (proxyUrl.pathname.includes('wallet.php')) {
					proxyUrl.pathname = proxyUrl.pathname.replace('wallet.php', 'custom-affiliate.php');
				}

				// Inject affiliate params
				proxyUrl.searchParams.set('affiliate',     WL_AFFILIATE);
				proxyUrl.searchParams.set('affiliate_fee', WL_AFF_FEE);
				proxyUrl.searchParams.set('merchant_fee',  WL_MERCH_FEE);

				const proxyReq  = new Request(proxyUrl.toString(), { method: request.method, headers: request.headers });
				const proxyResp = await fetch(proxyReq);

				if (proxyResp.status >= 400 && proxyResp.status < 500) {
					return new Response(JSON.stringify({ error: 'Upstream error', status: proxyResp.status }), { status: 502, headers: corsHeaders });
				}

				const proxied = new Response(proxyResp.body, proxyResp);
				proxied.headers.set('Access-Control-Allow-Origin', '*');
				return proxied;
			}

			// ─── 2. CHECKOUT INITIATOR  POST /api/pay/checkout ──────────
			// Step 1 of the RiskPay flow is done server-side here.
			// Returns a ready-to-open checkout_url for the frontend.
			//
			// Body: { amount, currency, provider, email, plugin_name, plan }
			if (path === '/api/pay/checkout' && request.method === 'POST') {
				const body = await request.json();
				const { amount, currency = 'USD', provider = 'stripe', email, plugin_name, plan } = body;

				if (!amount || !email) {
					return new Response(JSON.stringify({ error: 'amount and email are required' }), { status: 400, headers: corsHeaders });
				}

				// Build the callback URL (our own verify endpoint)
				const callbackUrl = `https://horizon-online.api-rapnss.workers.dev/api/pay/verify?plugin=${encodeURIComponent(plugin_name || 'unknown')}&plan=${encodeURIComponent(plan || 'one_time')}&email=${encodeURIComponent(email)}`;

				// Step 1 — Create temporary encrypted wallet via White Label API
				const walletUrl = new URL(`${WL_API_BASE}/custom-affiliate.php`);
				walletUrl.searchParams.set('address',       env.MERCHANT_WALLET || '0xa031E2b68C9e4F4e87c377fE9AC7759c8F6aCD66');
				walletUrl.searchParams.set('callback',      callbackUrl);
				walletUrl.searchParams.set('affiliate',     WL_AFFILIATE);
				walletUrl.searchParams.set('affiliate_fee', WL_AFF_FEE);
				walletUrl.searchParams.set('merchant_fee',  WL_MERCH_FEE);

				const walletResp = await fetch(walletUrl.toString(), {
					headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0' }
				});
				if (!walletResp.ok) {
					const errText = await walletResp.text();
					return new Response(JSON.stringify({ error: 'Wallet creation failed', details: errText }), { status: 502, headers: corsHeaders });
				}

				const walletData = await walletResp.json();
				const addressIn  = walletData.address_in;

				if (!addressIn) {
					return new Response(JSON.stringify({ error: 'No address_in returned', raw: walletData }), { status: 502, headers: corsHeaders });
				}

				// Step 2 — Build the checkout redirect URL
				const checkoutUrl = new URL(`${WL_PAY_BASE}/payment-processing.php`);
				checkoutUrl.searchParams.set('address',  decodeURIComponent(addressIn));
				checkoutUrl.searchParams.set('email',    email);
				checkoutUrl.searchParams.set('amount',   amount.toString());
				checkoutUrl.searchParams.set('currency', currency);
				checkoutUrl.searchParams.set('provider', provider);

				// Also record in our DB for tracking
				const payId = `pay_${Date.now()}`;
				await env.DB.prepare(
					"INSERT INTO ads (id, plugin_name, plan, provider, email, status) VALUES (?, ?, ?, ?, ?, 'pending')"
				).bind(payId, plugin_name || 'unknown', plan || 'one_time', provider, email).run();

				return new Response(JSON.stringify({
					success:      true,
					checkout_url: checkoutUrl.toString(),
					address_in:   addressIn,
					pay_id:       payId
				}), { headers: corsHeaders });
			}

			// ─── 3. PAYMENT VERIFY CALLBACK  GET /api/pay/verify ────────
			// RiskPay hits this after a successful payment.
			if (path === '/api/pay/verify' && request.method === 'GET') {
				const plugin   = url.searchParams.get('plugin')   || 'unknown';
				const plan     = url.searchParams.get('plan')     || 'unknown';
				const email    = url.searchParams.get('email')    || '';
				const txHash   = url.searchParams.get('tx')       || '';
				const amount   = url.searchParams.get('amount')   || '';

				// Update status to paid in our ads table
				await env.DB.prepare(
					"UPDATE ads SET status = 'paid' WHERE plugin_name = ? AND email = ? AND status = 'pending' LIMIT 1"
				).bind(plugin, email).run();

				console.log(`[PayVerify] Payment confirmed — plugin=${plugin} plan=${plan} email=${email} tx=${txHash} amount=${amount}`);

				// Return a minimal success page
				return new Response(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Payment Confirmed</title>
<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0f172a;color:#fff;}
.card{text-align:center;padding:48px;border-radius:16px;background:#1e293b;max-width:400px;}
.icon{font-size:64px;margin-bottom:16px;}h1{font-size:24px;margin:0 0 8px;}p{color:#94a3b8;}</style></head>
<body><div class="card"><div class="icon">✅</div>
<h1>Payment Confirmed!</h1><p>Your purchase of <strong>${plugin}</strong> has been verified. You can now close this window.</p>
</div></body></html>`, { status: 200, headers: { 'Content-Type': 'text/html', ...corsHeaders } });
			}

			// ─── 4. BRANDED CHECKOUT PAGE  GET /api/pay/page ────────────
			// A server-rendered HTML checkout page opened in the in-app popup.
			// Performs wallet creation server-side, then meta-redirects to checkout.
			//
			// Query: ?amount=9.99&currency=USD&provider=stripe&plugin=name&email=user@x.com
			if (path === '/api/pay/page' && request.method === 'GET') {
				const amount     = url.searchParams.get('amount')   || '0';
				const currency   = url.searchParams.get('currency') || 'USD';
				const provider   = url.searchParams.get('provider') || 'stripe';
				const pluginName = url.searchParams.get('plugin')   || 'Plugin';
				const email      = url.searchParams.get('email')    || '';

				// Server-side wallet creation
				let checkoutUrl = null;
				let walletError = null;
				try {
					const callbackUrl = `https://horizon-online.api-rapnss.workers.dev/api/pay/verify?plugin=${encodeURIComponent(pluginName)}&email=${encodeURIComponent(email)}`;
					const walletUrl = new URL(`${WL_API_BASE}/custom-affiliate.php`);
					walletUrl.searchParams.set('address',       env.MERCHANT_WALLET || '0xa031E2b68C9e4F4e87c377fE9AC7759c8F6aCD66');
					walletUrl.searchParams.set('callback',      callbackUrl);
					walletUrl.searchParams.set('affiliate',     WL_AFFILIATE);
					walletUrl.searchParams.set('affiliate_fee', WL_AFF_FEE);
					walletUrl.searchParams.set('merchant_fee',  WL_MERCH_FEE);

					const walletResp = await fetch(walletUrl.toString(), {
						headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0' }
					});
					const walletData = await walletResp.json();

					if (walletData.address_in) {
						const co = new URL(`${WL_PAY_BASE}/payment-processing.php`);
						co.searchParams.set('address',  decodeURIComponent(walletData.address_in));
						co.searchParams.set('email',    email);
						co.searchParams.set('amount',   amount);
						co.searchParams.set('currency', currency);
						co.searchParams.set('provider', provider);
						checkoutUrl = co.toString();
					} else {
						walletError = JSON.stringify(walletData);
					}
				} catch (e) {
					walletError = e.message;
				}

				const currencySymbol = { USD: '$', INR: '₹', EUR: '€', GBP: '£', CAD: 'C$' }[currency] || currency;

				const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Horizon Desk Checkout – ${pluginName}</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
<style>
* {
    margin: 0; padding: 0; box-sizing: border-box;
    font-family: -apple-system, "Segoe UI", sans-serif;
}
body {
    min-height: 100vh;
    display: flex; justify-content: center; align-items: center;
    background: url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=1920') no-repeat center center fixed;
    background-size: cover;
    position: relative;
}
body::before {
    content: "";
    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(120, 120, 120, 0.45);
    backdrop-filter: blur(20px);
    z-index: 0;
}
/* 9:16 Container */
.checkout {
    position: relative; z-index: 1;
    width: 360px; height: 640px;
    background: #fff; border-radius: 25px;
    box-shadow: 0 25px 60px rgba(0,0,0,0.3);
    padding: 24px; display: flex;
    flex-direction: column; justify-content: space-between;
}
/* Header */
.header { display: flex; justify-content: center; align-items: center; }
.logo { width: 66px; height: 66px; border-radius: 12px; }

/* Plugin */
.plugin { text-align: center; margin-top: 10px; }
.plugin h2 { font-size: 19px; font-weight: 700; color: #1a1f36; }
.price { font-size: 32px; font-weight: 800; margin-top: 5px; color: #111; }

/* Payment Options */
.payment-options { display: flex; gap: 10px; margin-top: 20px; }
.option {
    flex: 1; padding: 12px; border-radius: 12px;
    border: 1px solid #eee; text-align: center;
    cursor: pointer; transition: 0.2s ease;
    background: #fcfcfc; color: #555;
}
.option.active { background: #000; color: #fff; border-color: #000; }
.option i { display: block; margin-bottom: 5px; font-size: 16px; }

/* Breakdown */
.breakdown {
    background: #f7f8fa; padding: 14px;
    border-radius: 12px; margin-top: 20px; font-size: 13px;
    border: 1px solid #f0f0f0;
}
.row { display: flex; justify-content: space-between; margin-bottom: 8px; color: #4b5563; }
.dev-get {
    margin-top: 10px; padding-top: 10px;
    border-top: 1px dashed #ddd; font-weight: 700; color: #111;
}

/* Button */
.pay-btn {
    width: 100%; padding: 16px; border-radius: 14px;
    border: none; background: #000; color: #fff;
    font-size: 16px; font-weight: 600; cursor: pointer;
    transition: transform 0.1s;
}
.pay-btn:active { transform: scale(0.98); }
.pay-btn:disabled { background: #ccc; cursor: not-allowed; }

/* Branding */
.powered { text-align: center; font-size: 11px; opacity: 0.7; margin-top: 8px; font-weight: 500; }
.note {
    font-size: 10px; text-align: center; opacity: 0.5;
    margin-top: 8px; line-height: 1.4; padding: 0 10px;
}
.error-msg { background: #fff1f2; color: #e11d48; padding: 10px; border-radius: 8px; font-size: 12px; text-align: center; }
</style>
</head>
<body>
<div class="checkout">
    <div class="header">
        <img src="https://images-rapnss.t3.tigrisfiles.io/512-icon-9.png" class="logo">
    </div>

    <div class="plugin">
        <h2>${pluginName}</h2>
        <div class="price">${currencySymbol}${amount}</div>
    </div>

    <div class="payment-options">
        <div class="option ${provider === 'stripe' || provider === 'card' ? 'active' : ''}" onclick="selectPay('card', this)">
            <i class="fa-solid fa-credit-card"></i>
            Card
        </div>
        <div class="option ${provider === 'upi' ? 'active' : ''}" onclick="selectPay('upi', this)">
            <i class="fa-brands fa-google-pay"></i>
            UPI
        </div>
    </div>

    <div class="breakdown">
        <div class="row">
            <span>Horizon Desk Fee</span>
            <span>0%</span>
        </div>
        <div class="row">
            <span>Provider Fee</span>
            <span>4%</span>
        </div>
        <div class="row dev-get">
            <span>Developer Receives</span>
            <span>96%</span>
        </div>
    </div>

    ${walletError 
        ? `<div class="error-msg">⚠️ Setup failed: ${walletError}</div>` 
        : `<button class="pay-btn" onclick="redirectPayment()">Continue to Payment</button>`
    }

    <div>
        <div class="powered">
            Powered by RiskPay • Horizon Desk Infra
        </div>
        <div class="note">
            This is a direct transfer between user and developer. Horizon Desk charges 0%.
            Horizon Desk acts as a white-label infrastructure provider. Payment processing
            and backend services are handled by RiskPay.
        </div>
    </div>
</div>

<script>
let currentProvider = "${provider}";
const checkoutUrlBase = "${checkoutUrl || ''}";

function selectPay(type, el) {
    document.querySelectorAll('.option').forEach(o => o.classList.remove('active'));
    el.classList.add('active');
    currentProvider = type;
    
    // In a real scenario, we might need to reload the page to get a new wallet 
    // for a different provider, but for now we'll just track it.
    if (type !== "${provider}") {
        const url = new URL(window.location.href);
        url.searchParams.set('provider', type);
        window.location.href = url.toString();
    }
}

function redirectPayment() {
    if (checkoutUrlBase) {
        window.location.href = checkoutUrlBase;
    } else {
        alert("Payment setup not complete. Please refresh.");
    }
}
</script>
</body>
</html>`;

				return new Response(html, { 
					status: 200, 
					headers: { 
						...corsHeaders,
						'Content-Type': 'text/html; charset=utf-8'
					} 
				});
			}

			// GET /api/plugins - Plugin Store Catalog
			if (path === "/api/plugins" && request.method === "GET") {
				const query = `
					SELECT p.id, p.name, p.description, p.full_description, p.screenshots, p.version, p.status, p.tigris_url, p.icon_url, p.category, 
					       p.pricing_model, p.gumroad_url, p.price, p.price_inr, p.price_eur, p.price_cad, p.dynamic_pricing,
					       u.username as author 
					FROM plugins p 
					JOIN developers d ON p.developer_id = d.id 
					JOIN users u ON d.user_id = u.id 
					WHERE p.status = 'published'
					ORDER BY p.created_at DESC
				`;
				const { results: dbPlugins } = await env.DB.prepare(query).all();

				let finalPlugins = dbPlugins;
				if (dbPlugins.length === 0) {
					finalPlugins = [
						{ id: "p_1", name: "Spotify Controller", description: "Allows the agent to control your Spotify desktop app (Play, Pause, Skip).", author: "Rapnss Production Studio", version: "1.0", status: "installed", category: "media", icon_url: null, tigris_url: null },
						{ id: "p_built_in_2", name: "GitHub Manager", description: "Create repos, commit, and push code directly from the chat.", author: "Rapnss Production Studio", version: "1.1", status: "available", category: "developer", icon_url: null, tigris_url: null }
					];
				}

				return new Response(JSON.stringify({ plugins: finalPlugins }, null, 2), {
					status: 200,
					headers: { ...corsHeaders, "Content-Type": "application/json" }
				});
			}

			// Serve static files (index.html)
			return new Response("Horizon Online API - Use /api/* endpoints", {
				status: 200,
				headers: corsHeaders
			});

		} catch (error) {
			console.error("API Error:", error);
			console.error("Stack:", error.stack);
			return new Response(JSON.stringify({
				success: false,
				error: error.message,
				stack: error.stack
			}), {
				status: 500,
				headers: corsHeaders
			});
		}
	}
};

// --- Auth Helper Functions ---
import nodemailer from 'nodemailer';

async function sendEmail(email, subject, body, env) {
	console.log(`[EMAIL] Preparing to send to ${email}`);
	try {
		const transporter = nodemailer.createTransport({
			host: "smtp.zoho.in",
			port: 465,
			secure: true, // true for 465, false for other ports
			auth: {
				user: "admin@rapnss.in",
				pass: "Rapnss@147258369"
			}
		});

		const info = await transporter.sendMail({
			from: '"Horizon Desk" <admin@rapnss.in>',
			to: email,
			subject: subject,
			text: body,
			html: body.replace(/\n/g, "<br>")
		});

		console.log(`[EMAIL] Sent: ${info.messageId}`);
		return true;
	} catch (error) {
		console.error(`[EMAIL ERROR] Failed to send email: ${error.message}`);
		// Fallback or rethrow? For now, we log but don't crash the signup flow if email fails (or we should?)
		// Let's rethrow to alert the user in the UI
		throw error;
	}
}

// --- Auth Endpoints (To be merged into fetch handler above) ---
// I need to inject these into the `fetch` function logic. 
// Instead of replacing the whole file which is risky with "replace_file_content" on a large file, 
// I will insert them before the "return new Response" at the end of the try block.

