const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: 8080 });

let users = [];

function sendToUser(userName, msg) {
    const user = users.find(u => u.userName === userName);
    if (user && user.ws && user.ws.readyState === WebSocket.OPEN) {
        user.ws.send(JSON.stringify(msg));
    }
}

function broadcast(msg, exceptUser = null) {
    users.forEach(u => {
        if (u.ws && u.ws.readyState === WebSocket.OPEN && u.userName !== exceptUser) {
            u.ws.send(JSON.stringify(msg));
        }
    });
}

wss.on("connection", function connection(ws) {
    ws.on("message", function incoming(message) {
        let msg;
        try {
            msg = JSON.parse(message);
        } catch (e) {
            return;
        }

        // Kullanıcı giriş
        if (msg.Type === "user_join") {
            let userInfo;
            try {
                userInfo = JSON.parse(msg.Content);
            } catch {
                userInfo = {};
            }
            users = users.filter(u => u.userName !== msg.Sender);
            users.push({
                userName: msg.Sender,
                ws: ws,
                ip: userInfo.IpAddress || "",
                port: userInfo.Port || 0,
                localIp: userInfo.LocalIp || ""
            });
            // Kullanıcı listesi güncelle
            broadcast({
                Type: "user_list",
                Content: JSON.stringify(users.map(u => ({
                    UserName: u.userName,
                    IpAddress: u.ip,
                    Port: u.port,
                    LocalIp: u.localIp
                })))
            });
            return;
        }

        // Kullanıcı çıkış
        if (msg.Type === "user_leave") {
            users = users.filter(u => u.userName !== msg.Sender);
            broadcast({
                Type: "user_list",
                Content: JSON.stringify(users.map(u => ({
                    UserName: u.userName,
                    IpAddress: u.ip,
                    Port: u.port,
                    LocalIp: u.localIp
                })))
            });
            return;
        }

        // Komutlar
        if (msg.Type === "command") {
            broadcast(msg);
            return;
        }

        // Genel sohbet
        if (msg.Type === "chat") {
            broadcast(msg);
            return;
        }

        // Özel mesaj
        if (msg.Type === "private_chat" && msg.Receiver) {
            sendToUser(msg.Receiver, msg);
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

        // Çağrı sonlandırma
        if (msg.Type === "call_end") {
            if (msg.Receiver) sendToUser(msg.Receiver, msg);
            if (msg.Sender) sendToUser(msg.Sender, msg);
            return;
        }
    });

    ws.on("close", function () {
        // Bağlantı kopunca kullanıcıyı sil
        users = users.filter(u => u.ws !== ws);
        broadcast({
            Type: "user_list",
            Content: JSON.stringify(users.map(u => ({
                UserName: u.userName,
                IpAddress: u.ip,
                Port: u.port,
                LocalIp: u.localIp
            })))
        });
    });
});
