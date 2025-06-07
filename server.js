const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

let clients = []; // { ws, userName, ipAddress, port, localIp }

function broadcastUserList() {
    const userList = clients.map(c => ({
        UserName: c.userName,
        IpAddress: c.ipAddress,
        Port: c.port,
        LocalIp: c.localIp
    }));
    const msg = {
        Type: "user_list",
        Content: JSON.stringify(userList)
    };
    const data = JSON.stringify(msg);
    clients.forEach(c => c.ws.readyState === WebSocket.OPEN && c.ws.send(data));
}

function sendToUser(userName, msgObj) {
    const target = clients.find(c => c.userName === userName);
    if (target && target.ws.readyState === WebSocket.OPEN) {
        target.ws.send(JSON.stringify(msgObj));
    }
}

wss.on('connection', function connection(ws, req) {
    let currentUser = null;

    ws.on('message', function incoming(message) {
        let msg;
        try {
            msg = JSON.parse(message);
        } catch (e) {
            return;
        }

        // Kullanıcı girişini işle
        if (msg.Type === "user_join") {
            let userInfo = {};
            try {
                userInfo = JSON.parse(msg.Content);
            } catch {}
            currentUser = {
                ws,
                userName: userInfo.UserName || msg.Sender,
                ipAddress: userInfo.IpAddress || "",
                port: userInfo.Port || 0,
                localIp: userInfo.LocalIp || ""
            };
            clients.push(currentUser);
            broadcastUserList();
            return;
        }

        // Kullanıcı çıkışı
        if (msg.Type === "user_leave") {
            clients = clients.filter(c => c.ws !== ws);
            broadcastUserList();
            return;
        }

        // Komutlar (herkese)
        if (msg.Type === "command") {
            clients.forEach(c => c.ws.readyState === WebSocket.OPEN && c.ws.send(message));
            return;
        }

        // Genel sohbet (herkese)
        if (msg.Type === "chat") {
            clients.forEach(c => c.ws.readyState === WebSocket.OPEN && c.ws.send(message));
            return;
        }

        // Özel mesaj (private_chat)
        if (msg.Type === "private_chat" && msg.Receiver) {
            sendToUser(msg.Receiver, msg);
            // Gönderenin de ekranında görünsün
            if (msg.Sender && msg.Sender !== msg.Receiver) {
                sendToUser(msg.Sender, msg);
            }
            return;
        }

        // Özel oda daveti ve cevapları
        if (msg.Type === "private_invite" || msg.Type === "private_invite_response" || msg.Type === "private_room_close") {
            if (msg.Receiver) sendToUser(msg.Receiver, msg);
            if (msg.Type === "private_room_close" && msg.Sender) sendToUser(msg.Sender, msg);
            return;
        }

        // SESLİ ARAMA MESAJLARI (EKLENDİ)
        if (
            (msg.Type === "voice" || msg.Type === "voice_test" || msg.Type === "voice_test_ok")
            && msg.Receiver
        ) {
            sendToUser(msg.Receiver, msg);
            return;
        }

        // Çağrı ve cevapları
        if (msg.Type === "call" || msg.Type === "call_response") {
            if (msg.Receiver) sendToUser(msg.Receiver, msg);
            if (msg.Type === "call_response" && msg.Sender) sendToUser(msg.Sender, msg);
            return;
        }
    });

    ws.on('close', function () {
        clients = clients.filter(c => c.ws !== ws);
        broadcastUserList();
    });
});

console.log(`WebSocket sunucusu ${PORT} portunda çalışıyor.`);
