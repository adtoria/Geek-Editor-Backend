const User = require("../models/user");
const genPassword = require("../utils/passwordUtils").genPassword;
const validator = require('validator');
const { ObjectId } = require('mongodb');
const jwt = require("jsonwebtoken");
const validPassword = require("../utils/passwordUtils").validPassword;

exports.verifyUser = async(req,res,next) => {
  const token = req.headers["x-access-token"];
  if(!token){
    return res.status(403).json({
      success: false,
      error: "Token is required"
    })
  }
  const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User Not Found'
      });
    }
    try {
      const decoded = jwt.verify(token, "secret_key");
      req.user = decoded;
    } catch (err) {
      return res.status(404).json({
        success: false,
        error: 'Wrong token'
      });
    }
    next();
}


// -------GET PROFILE-------
exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.find({ username: req.params.username });
    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: `Error Getting Users: ${error.message}`,
    });
  }
};


// -------ADD PROFILE-------
exports.addProfile = async (req, res, next) => {
  try {
    
    const {email,password,fname,lname,username} = req.body

    if (!(email && password && fname && lname && username)) {
      return res.status(400).json({
        success: false,
        error: "All input is required"
      });
    }

    const saltHash = genPassword(req.body.password);
    const salt = saltHash.salt;
    const hash = saltHash.hash;

    if (!validator.isEmail(req.body.email)) {
      throw new Error("Email is invalid");
    }
    const token = jwt.sign(
      { username: req.body.username, email:req.body.email },
       'secret_key',
      {
        expiresIn: "2h",
      }
    );
    const newUser = new User({
      username: req.body.username,
      hash: hash,
      salt: salt,
      fname: req.body.fname,
      lname: req.body.lname,
      email: req.body.email,
      token: token,
    });


    /* -------Save Profile------- */
    await newUser.save();

    return res.status(201).json({
      success: true,
      data: newUser,
    });
  } catch (err) {
    console.log("Error occured while registering", err);
    return res.status(400).json({
      success: false,
      error: `Error Adding User: ${err.message}`,
    });
  }
};


// -------LOGIN-------
exports.login = async (req, res, next) => {

    try {
      const { email, password } = req.body;
      
      if (!(email && password)) {
        res.status(400).json({
          success: false,
          error: "All input is required"});
      }
      const user = await User.findOne({email: email});
  
      if (user && (await validPassword(password,user.hash, user.salt))) {
        const token = jwt.sign(
          { user_id: user._id, email },
          "secret_key",
          {
            expiresIn: "2h",
          }
        );
          user.token = token;
  
        return res.status(200).json({
          success: true,
          data:user });
      }
      return res.status(400).json({
        success: false,
        error: `Invalid credentials`,
      });
    } catch (err) {
        return res.status(500).json({
        success: false,
        error: `Error loging in : ${err.message}`,
      });    
  }
};


// -------UPDATE USER-------
exports.updateUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).exec();
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User Not Found'
      });
    }

    user.set(req.body);
    var update = await user.save();
    return res.status(200).json({
      success: true,
      data: update
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: `Error Getting User ${req.params.id}: ${error.message}`
    });
  }
};


//-------DELETE USER-------
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User Not Found'
      });
    }

    await user.remove();

    return res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: `Error Deleting User: ${error.message}`,
    });
  }
};


// -------GET USER BY ID-------
exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User Not Found'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: `Error Getting User ${req.params.id}: ${error.message}`
    });
  }
};


//-------FOLLOW USER-------
exports.followUser = async (req, res, next) => {
  const _id = req.params.id;
  try {
    if (!_id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(404).json({ success: false, error: `Invalid User Id provided` });
    }
    const user = await User.findById(_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User Not Found'
      });
    }

    const updatedUser1Res = await User.updateOne({ _id: ObjectId(req.user._id) }, { $addToSet: { following: [ObjectId(_id)] } });
    const updatedUser2Res = await User.updateOne({ _id: ObjectId(_id) }, { $addToSet: { followers: [ObjectId(req.user._id)] } });
    res.status(200).json({ success: true, mesg: 'User followed' });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      error: `Error Following User: ${error.message}`,
    });
  }
};