const fs = require('fs')
const key= fs.readFileSync('./roktosheba-firebase-adminsdk.json','utf-8')
const base64= Buffer.from(key).toString('base64')
console.log(base64);