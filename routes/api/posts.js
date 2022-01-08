const express = require('express');
const app = express();
const router = express.Router();
const bodyParser = require('body-parser')
const Post = require('../../schemas/PostSchema')
const User = require('../../schemas/UserSchema')
const Notification = require('../../schemas/NotificationSchema')


app.use(bodyParser.urlencoded({extended: false}));

router.get("/", async (req,res,next) => {

    var searchObj = req.query;

    //check if post is a reply
    if (searchObj.isReply !== undefined){
        var isReply = searchObj.isReply == "true";
        searchObj.replyTo = {$exists: isReply};
        delete searchObj.isReply;
    }

    //search page
    if(searchObj.search !== undefined){
        searchObj.content = {$regex: searchObj.search, $options: "i"}
    }

    //home page, only show posts from people we're following
    if(searchObj.followingOnly !== undefined){
        var followingOnly = searchObj.followingOnly == 'true';

        if(followingOnly){
            var objectIds = [];

            if(!req.session.user.following) {
                req.session.user.following = [];
            }
            
            req.session.user.following.forEach(user => {
                objectIds.push(user)
            })
        
            objectIds.push(req.session.user._id);
            searchObj.postedBy = {$in: objectIds};
        }
        
        delete searchObj.followingOnly;
    }


    var results = await getPosts(searchObj);
    res.status(200).send(results);
});

router.get("/:id", async (req,res,next) => {

    var postId = req.params.id;

    var postData = await getPosts({_id: postId});
    postData = postData[0];
    
    var results = {
        postData: postData,
    }

    if (postData.replyTo !== undefined){
        results.replyTo = postData.replyTo;
    }

    results.replies = await getPosts({replyTo: postId});

    res.status(200).send(results);
});

router.post("/", async (req,res,next) => {

    // if(req.body.replyTo){
    //     console.log(req.body.replyTo)
    //     return res.sendStatus(400);
    // }

    if(!req.body.content){
        console.log("Content param not sent with request");
        return res.sendStatus(400)
    }

    var postData = {
        content: req.body.content,
        postedBy: req.session.user,
    }

    if(req.body.replyTo){
        postData.replyTo = req.body.replyTo;
    }

    Post.create(postData)
        .then(async (newPost) => {
            newPost = await User.populate(newPost, {path: "postedBy"})
            newPost = await Post.populate(newPost, {path: "replyTo"})
            

            if(newPost.replyTo !== undefined){
                await Notification.insertNotification(newPost.replyTo.postedBy, req.session.user._id, "reply", newPost._id);
            }

            res.status(201).send(newPost);
        })
        .catch((err)=> {
            console.log(err)
            res.sendStatus(400)
        })
});

router.post("/:id/retweet", async (req,res,next) => {

    var postId = req.params.id;
    var userId = req.session.user._id;

    //Try and delete retweet
    var deletedPost = await Post.findOneAndDelete({postedBy: userId, retweetData: postId})
    .catch(error => {
        console.log(error);
        res.sendStatus(400);
    })

    var option = deletedPost != null ? "$pull" : "$addToSet";

    var repost = deletedPost;

    if (repost == null){
        repost = await Post.create({postedBy: userId, retweetData: postId})
    }

    //insert user retweet
    req.session.user = await User.findByIdAndUpdate(userId, {[option]: {retweets: repost._id}}, {new:true})
        .catch(err => {
            console.log(err);
            res.sendStatus(400);
        })

    //insert post like
    var post = await Post.findByIdAndUpdate(postId, {[option]: {retweetUsers: userId}}, {new:true})
    .catch(err => {
        console.log(err);
        res.sendStatus(400);
    })

    if(!deletedPost){
        await Notification.insertNotification(post.postedBy, userId, "retweet", post._id);
    }

    res.status(200).send(post)
});

router.put("/:id/like", async (req,res,next) => {

    var postId = req.params.id;
    var userId = req.session.user._id;
    var isLiked = req.session.user.likes && req.session.user.likes.includes(postId);

    var option = isLiked ? "$pull" : "$addToSet";
    console.log(option)
    console.log(isLiked)
    console.log(userId)
    console.log(postId)

    //insert user like
    req.session.user = await User.findByIdAndUpdate(userId, {[option]: {likes: postId}}, {new:true})
        .catch(err => {
            console.log(err);
            res.sendStatus(400);
        })

    //insert post like
    var post = await Post.findByIdAndUpdate(postId, {[option]: {likes: userId}}, {new:true})
    .catch(err => {
        console.log(err);
        res.sendStatus(400);
    })

    if(!isLiked){
        await Notification.insertNotification(post.postedBy, userId, "postLike", post._id);
    }

    res.status(200).send(post)
});

router.delete("/:id", (req, res, next) => {
    Post.findByIdAndDelete(req.params.id)
    .then(result => res.sendStatus(202))
    .catch((err) => {
        console.log(err);
        res.sendStatus(400);
    })
})

router.put("/:id", async (req, res, next) => {

    if(req.body.pinned !== undefined){
        await Post.updateMany({postedBy: req.session.user}, {pinned:false})
    }

    Post.findByIdAndUpdate(req.params.id, req.body)
    .then(() => res.sendStatus(204))
    .catch((err) => {
        console.log(err);
        res.sendStatus(400);
    })
})



async function getPosts(filter){
    var results = await Post.find(filter)
    .populate("postedBy")
    .populate("retweetData")
    .populate("replyTo")
    .sort({"createdAt": -1})
    .catch(err=> console.log(err))

    results = await User.populate(results, {path: "replyTo.postedBy"});
    return await User.populate(results, {path: "retweetData.postedBy"});
    
    
}

module.exports = router;