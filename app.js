const express = require('express');
const app = express();
const port = 3003;
const middleware = require('./middleware')
const path = require('path')
const bodyParser = require("body-parser")
const mongoose = require("./database");
const session = require("express-session")

const server = app.listen(port, () => console.log("Sever listening on port " + port));
const io = require('socket.io')(server, { cors: {
    origin: "http://localhost:3003",
    methods: ["GET", "POST"],
    transports: ['websocket', 'polling'],
    credentials: true
}, pingTimeout: 60000,allowEIO3: true});


app.set("view engine", "pug");
app.set("views","views");

app.use(bodyParser.urlencoded({extended: false}));
app.use(express.static(path.join(__dirname, "public")))

app.use(session({
    secret: "T7NoaE9w7i1ZrjEF7VN56u4GLxsn6J43gTWitSWXavvYk3rkW",
    resave: true,
    saveUninitialized: false
}))
// Routes
const registerRoute = require('./routes/registerRoutes');
const loginRoute = require('./routes/loginRoutes');
const logoutRoute = require('./routes/logoutRoutes');
const postRoute = require('./routes/postRoutes');
const profileRoute = require('./routes/profileRoutes');
const uploadRoute = require('./routes/uploadRoutes');
const searchRoute = require('./routes/searchRoutes');
const messagesRoute = require('./routes/messagesRoutes');
const notificationsRoute = require('./routes/notificationRoutes');


//Api Routes

const postsApiRoute = require('./routes/api/posts')
const usersApiRoute = require('./routes/api/users')
const chatsApiRoute = require('./routes/api/chats')
const messagesApiRoute = require('./routes/api/messages')
const notificationsApiRoute = require('./routes/api/notifications')


app.use("/register", registerRoute);
app.use("/login", loginRoute);
app.use("/logout", logoutRoute);
app.use("/posts",middleware.requireLogin, postRoute);
app.use("/profile",middleware.requireLogin, profileRoute);
app.use("/uploads", uploadRoute);
app.use("/search",middleware.requireLogin,searchRoute);
app.use("/messages",middleware.requireLogin,messagesRoute);
app.use("/notifications",middleware.requireLogin,notificationsRoute);


app.use("/api/posts", postsApiRoute);
app.use("/api/users", usersApiRoute);
app.use("/api/chats", chatsApiRoute);
app.use("/api/messages", messagesApiRoute);
app.use("/api/notifications", notificationsApiRoute);


app.get("/", middleware.requireLogin, (req,res,next) => {

    var payload = {
        pageTitle: "Home",
        userLoggedIn: req.session.user,
        userLoggedInJs: JSON.stringify(req.session.user),
    }

    res.status(200).render("home",payload)
});

io.on("connection", (socket) => {
    socket.on("setup", userData => {
        socket.join(userData._id);
        socket.emit("connected")
    } )

    socket.on("join room", room => {
        console.log("joined room " + room)
        socket.join(room)
    })

    socket.on("typing", room => {

        console.log("app typing")
        socket.in(room).emit("typing")
    })

    socket.on("stop typing", room => socket.in(room).emit("stop typing"));

    socket.on("notification received", room => socket.in(room).emit("notification received"));


    socket.on("new message", newMessage => {
        console.log("new msg app")
        var chat = newMessage.chat;

        if(!chat.users) return console.log("Chat.users not defined");

        chat.users.forEach(user => {
            
            if(user._id == newMessage.sender._id) return;
            console.log(user._id)
            socket.in(user._id).emit("message received", newMessage);
        })
    })
})