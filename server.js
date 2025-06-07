const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

let clients = []; // { ws, userName, ipAddress, port, localIp }
let users = [
    { userName: "admin", password: "kalkanpanel" },
    { userName: "celal", password: "Ck100622" }
];

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
function sendUserListTo(targetWs) {
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
    if (targetWs && targetWs.readyState === WebSocket.OPEN) {
        targetWs.send(data);
    }
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

        // Kullanıcı listesi isteği
        if (msg.Type === "user_list_request") {
            sendUserListTo(ws);
            return;
        }

        // Kullanıcı ekle (sadece admin)
        if (msg.Type === "add_user" && msg.UserName && msg.Password) {
            if (msg.AdminKey === "key_celal_admin_ekle") {
                users.push({ userName: msg.UserName, password: msg.Password });
                ws.send(JSON.stringify({ Type: "add_user_response", Success: true }));
            } else {
                ws.send(JSON.stringify({ Type: "add_user_response", Success: false, Error: "Yetkisiz" }));
            }
            return;
        }

        // Kullanıcıları listele (sadece admin)
        if (msg.Type === "list_users" && msg.AdminKey === "key_celal_admin_ekle") {
            ws.send(JSON.stringify({
                Type: "list_users_response",
                Users: users // [{userName, password}, ...]
            }));
            return;
        }

        // Kullanıcı sil (sadece admin)
        if (msg.Type === "delete_user" && msg.AdminKey === "key_celal_admin_ekle") {
            users = users.filter(u => u.userName !== msg.UserName);
            ws.send(JSON.stringify({
                Type: "delete_user_response",
                Success: true
            }));
            return;
        }

        // Şifre değiştir (kendi şifresi)
        if (msg.Type === "change_password" && msg.UserName && msg.OldPassword && msg.NewPassword) {
    const user = users.find(u => u.userName.toLowerCase() === msg.UserName.toLowerCase() && u.password === msg.OldPassword);
    if (user) {
        user.password = msg.NewPassword;
        ws.send(JSON.stringify({ Type: "change_password_response", Success: true }));
    } else {
        ws.send(JSON.stringify({ Type: "change_password_response", Success: false, Error: "Eski şifre yanlış veya kullanıcı adı hatalı" }));
    }
    return;
}

        // Kullanıcı adı ve şifre doğrulama (giriş)
        if (msg.Type === "auth_request") {
            const isValid = users.some(u => u.userName === msg.UserName && u.password === msg.Password);
            ws.send(JSON.stringify({
                Type: "auth_response",
                Success: isValid
            }));
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
    // Sesli arama ve test paketleri (voice, voice_test, voice_test_ok)
if (
    (msg.Type === "voice" || msg.Type === "voice_test" || msg.Type === "voice_test_ok")
    && msg.Receiver
) {
    sendToUser(msg.Receiver, msg);
    return;
}
        // Çağrı ve cevapları + çağrı sonlandırma
if (msg.Type === "call" || msg.Type === "call_response" || msg.Type === "call_end") {
    if (msg.Receiver) sendToUser(msg.Receiver, msg);
    if ((msg.Type === "call_response" || msg.Type === "call_end") && msg.Sender) sendToUser(msg.Sender, msg);
    return;
}
    });

    ws.on('close', function () {
        clients = clients.filter(c => c.ws !== ws);
        broadcastUserList();
    });
});

console.log(`WebSocket sunucusu ${PORT} portunda çalışıyor.`);
