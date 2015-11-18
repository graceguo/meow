var express = require('express');
var router = express.Router();
var request = require("request");

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.post('/proxy', function (req, res) {
  console.log('send request to: ' + req.body.requestURL);

  request({
    uri: req.body.requestURL,
    method: "GET",
    timeout: 10000,
    followRedirect: true,
    maxRedirects: 10
  }, function(error, response, body) {
    if (error) {
      res.status(err.status || 500);
      res.render('error', {
        message: err.message,
        error: {}
      });
    }

    var tokenParts = body.split('&');
    var data = {};
    tokenParts.forEach(function(part) {
      var pair = part.split('=');
      if (pair && pair.length == 2) {
        var name = pair[0];
        var value = pair[1];
        data[name] = value;
      }
    });
    console.log('get proxy response:' + body);
    res.send('<div id="data-container">'+ JSON.stringify(data) + '</div>');
  });
});

module.exports = router;
