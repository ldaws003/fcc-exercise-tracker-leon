const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')

const mongoose = require('mongoose')
process.env.MLAB_URI="mongodb://ldaws003:Captaincommando5@ds157923.mlab.com:57923/exercisetracker";
mongoose.connect(process.env.MLAB_URI)

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

//creating schema

var userSchema = mongoose.Schema({
  username:String,
  count:Number,
  log:[]
});

var user = mongoose.model('user', userSchema);

//inputing username
app.post('/api/exercise/new-user', function(req, res){
  let userName = req.body.username;

  user.findOne({username: userName}, function(err, data){
    if(err) throw err;

    if(data){
      res.send("This user already exists. Choose another username");
    } else {
      var newUser = new user({
        username: userName,
        count: 0,
        log: []
      });
      newUser.save(function(err){ 
        if(err) throw err;
        user.findOne({username: userName}, function(err, data){
          var extractedUser = {"username": data.username, "_id": data._id};
          res.json(extractedUser);
        });
      });
    }
  });
});

//date parser
function parseDate(str) {
  if(str == ""){return true;}
  var date = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(date !== null){
    var d = +date[3], m = +date[2], y = +date[1];
    var date = new Date(y, m - 1, d);
    if(date.getFullYear() === y && date.getMonth() === m - 1) {
      return true;   
    }
  }  
  return false;
}



//inputing exercise
app.post('/api/exercise/add', function(req, res){

  var userId = req.body.userId;
  var duration = req.body.duration;
  var description = req.body.description;
  var date = req.body.date;
  var pass = false;
  
  
  //check to see if date and input duration is correct
  var durationTestRegex = /^\d+$/;
  if(!parseDate(date)){
    res.send("Date is not in the correct format.");
    pass = true;
  } else if (date == ""){
    var today = new Date();
    var dd = today.getDate();
    var mm = today.getMonth()+1;
    var yyyy = today.getFullYear();
    if(dd<10){
      dd='0'+dd;
    }
    if(mm<10){
      mm='0'+mm;
    }
    var date = yyyy+'-'+mm+'-'+dd;
  }
  
  if(!durationTestRegex.test(duration)){
    res.send("Duration needs to be in numbers.");
    pass = true;
  } else {
    duration = Number(duration);
  } 
   
  //checking to see if the userid exists
  if(!pass){
    user.findById({"_id":userId}, function(err, data){
      if(err){ console.log(err);}
      if(data != null){
        if(!pass){
          var logJson = {
            description: description,
            duration: duration,
            date: date
          };
          res.json({
            username: data.username,
            description: description,
            duration: duration,
            date: date
          });
            
          var updateLog = [logJson, ...data.log];
          user.findOneAndUpdate({username: data.username}, {$set: {log: updateLog, count: data.count + 1}}, function(err, data){
            if(err) console.log(err);
          });         
        }
      } else {
        res.send("The user by that id doesn't exist.");
      }
    });  
  }       
});

//retrieving logs
app.get('/api/exercise/log?*', function(req, res){
  var urlTestRegex = /api\/exercise\/log\?userId=\w+(&from=\d{4}-\d{2}-\d{2}&to\d{4}-\d{2}-\d{2})*(&limit=\d+)*/;
  if(urlTestRegex.test(req.originalUrl)){
    res.send("Incorrect format.");
    return;    
  }
  var pathName = req.originalUrl.replace('/api/exercise/log?', "");
  var userIdRegex = /userId=\w+/;
  var dateRegex = /\d{4}-\d{2}-\d{2}/g;
  var limitRegex = /limit=\d+/;
  
  var userId = pathName.match(userIdRegex)[0].replace("userId=", "");
  var dateArr = pathName.match(dateRegex);
  var from;
  var to;
  
  if(dateArr != null){
    from = dateArr[0];
    to = dateArr[1];
  }

  var limit = pathName.match(limitRegex);

  if(limit){
    limit = Number(limit[0].replace("limit=",""));
  }
  
  user.findById({"_id": userId}, function(err, data){
    if(err){console.log(err);}
    if(data){
      var resJson = {
        "username":data.username,
        "_id":data._id,
        "log":data.log
      };
      
      var fromTime = new Date(from).getTime();
      var toTime = new Date(to).getTime();

      
      if(dateArr != null){
        if(fromTime > toTime){
          res.send("The dates need to be from the earliest date to the latest."); 
        } else if (from == undefined || to == undefined){
          res.send("Two dates need to be given."); 
        } else {
          resJson.log = resJson.log.filter(d => {var time = new Date(d.date).getTime();                                                                  
                                   return (fromTime < time && time < toTime);
                                  });
        }      
      }
      
      if(limit != null){
        resJson.log = resJson.log.splice(0,limit);      
      }
      
      res.json(resJson);
    }else{
      res.send("No user with that id.");
    }
  });
});


// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})




const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
