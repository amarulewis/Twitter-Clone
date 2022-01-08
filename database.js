const mongoose = require("mongoose")

class Database{

    constructor(){
        this.connect()
    }

    connect(){
        mongoose.connect("mongodb://127.0.0.1:27017/twitter")
        .then(() => {
            console.log("database connection successful")
        })
        .catch((err) => {
            console.log("database connection error " + err)
        })
    }
}

module.exports = new Database();