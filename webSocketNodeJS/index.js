const	fs = require('fs');
const	options =
	{
		key:fs.readFileSync("/home/zoulhafi/certs/server.key"),
		cert:fs.readFileSync("/home/zoulhafi/certs/server.crt"),
		ca:[
			fs.readFileSync("/home/zoulhafi/certs/server.p7b"),
			fs.readFileSync("/home/zoulhafi/certs/server.ca-bundle")
		]
	}
const	https = require('https');
const	httpsServer = https.createServer(options);
httpsServer.listen(443);
const	WebSocketServer = require('ws').Server;
const	wss = new WebSocketServer({ server: httpsServer });
let	users = {};

function loginSuccess(ok)
{
	return ({ type: "login", success: ok });
}

function unrecognized(type)
{
	return ({ type: "error", message: "Unrecognized command: " + type });
}

function unrecognizedClient(name)
{
	return ({ type: "error", message: "Unrecognized client : " + name });
}

function noOtherClient()
{
	return ({ type: "error", message: "You must create a connection with another client." });
}

function cannotAnswer()
{
	return ({ type: "error", message: "You must receive an offer before answering." });
}


function offer(offer, otherName)
{
	return ({ type: "offer", offer, otherName });
}

function answer(answer)
{
	return ({ type: "answer", answer });
}

function candidate(candidate)
{
	return ({ type: "candidate", candidate });
}

function leave()
{
	return ({ type: "leave" });
}

function sendTo(conn, message)
{
	conn.send(JSON.stringify(message));
}

function caseLogin(conn, data)
{
	if (conn.name || users[data.name] || !data.name)
		sendTo(conn, loginSuccess(false));
	else
	{
		console.log("User logged in as : ", data.name);
		users[data.name] = conn;
		conn.name = data.name;
		conn.canAnswer = false;
		conn.otherName = null;
		sendTo(conn, loginSuccess(true));
	}
}

function caseOffer(conn, data)
{
	let otherConn;

	if (!conn.name || !data.otherName || !data.offer)
		return ;
	otherConn = users[data.otherName];
	if (otherConn != null && conn != otherConn)
	{
		console.log("Sending offer to : ", data.otherName)
		otherConn.canAnswer = true;
		otherConn.otherName = conn.name;
		conn.otherName = data.otherName;
		sendTo(otherConn, offer(data.offer, conn.name));
	}
	else
		sendTo(conn, unrecognizedClient(data.otherName));
}

function caseAnswer(conn, data)
{
	let otherConn;

	if (!conn.name || !conn.canAnswer || !data.answer)
		return ;
	console.log("Sending answer to : ", conn.otherName);
	if (conn.otherName != null)
	{
		otherConn = users[conn.otherName];
		conn.canAnswer = false;
		if (otherConn != null)
			sendTo(otherConn, answer(data.answer));
	}
	else
		sendTo(conn, cannotAnswer());
}

function caseCandidate(conn, data)
{
	let otherConn;

	if (!conn.name || !conn.otherName)
		return ;
	otherConn = users[conn.otherName];
	if (otherConn)
		sendTo(otherConn, candidate(data.candidate));
	else
		sendTo(conn, noOtherClient());

}

function caseLeave(conn)
{
	let otherConn;

	if (!conn.name)
		return ;
	otherConn = users[conn.otherName];
	if (otherConn)
	{
		conn.otherName = null;
		otherConn.otherName = null;
		otherConn.canAnswer = false;
		sendTo(otherConn, leave());
	}
}

function onMessage(conn, message)
{
	let data;

	try { data = JSON.parse(message); }
	catch (e)
	{ 
		console.log("Error Parsing JSON");
		data = {}; 
	}
	console.log(`Data received : ${message}`);
	if (!data.type)
		return ;
	switch (data.type)
	{
		case "login":
			caseLogin(conn, data);
			break;
		case "offer":
			caseOffer(conn, data);
			break;
		case "answer":
			caseAnswer(conn, data);
			break;
		case "candidate":
			caseCandidate(conn, data);
			break;
		case "leave":
			caseLeave(conn);
			break;
		default:
			sendTo(conn, unrecognized(data.type)); 
			break;
	}
}

function onClose(conn)
{
	let otherConn;

	if (conn.name)
	{
		if (conn.otherName)
		{
			otherConn = users[conn.otherName];
			if (otherConn)
			{
				otherConn.otherName = null;
				otherConn.canAnswer = false;
				sendTo(otherConn, leave());
			}
		}
		delete users[conn.name];
	}
}

wss.on("connection", (connection) =>
	{
		console.log("User connected");
		connection.on("message", (msg) => { onMessage(connection, msg); });
		connection.on("close", () => { onClose(connection) });
	});
