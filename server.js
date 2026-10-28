const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8083;
const DATA = path.join(__dirname, 'data.json');

app.use(express.json({limit:'1mb'}));
app.use(express.static(path.join(__dirname, 'public')));

function loadData() {
  try { return JSON.parse(fs.readFileSync(DATA, 'utf8')); }
  catch { return {users:[], movies:[
    {id:1,title:'Big Buck Bunny',poster:'https://commons.wikimedia.org/wiki/Special:FilePath/Big_buck_bunny_poster_big.jpg',genre:'Animation',year:2008,description:'A cheerful animated adventure.',video:'https://raw.githubusercontent.com/andreasbotsikas/DemoVideos/master/big_buck_bunny.mp4',download:true},
    {id:2,title:'Elephants Dream',poster:'https://commons.wikimedia.org/wiki/Special:FilePath/ElephantsDreamPoster.jpg',genre:'Sci-Fi',year:2006,description:'A surreal journey through a strange world.',video:'https://raw.githubusercontent.com/andreasbotsikas/DemoVideos/master/elephants_dream.mp4',download:true},
    {id:4,title:'Spring',poster:'https://img.youtube.com/vi/WhWc3b3KhnY/hqdefault.jpg',genre:'Fantasy',year:2019,description:'A shepherd girl and her dog face ancient spirits.',video:'',youtubeId:'WhWc3b3KhnY',download:false},
    {id:5,title:'Cosmos Laundromat',poster:'https://img.youtube.com/vi/Y-rmzh0PI3c/hqdefault.jpg',genre:'Sci-Fi',year:2015,description:'A sheep meets a mysterious salesman offering new lives.',video:'',youtubeId:'Y-rmzh0PI3c',download:false},
    {id:6,title:'Tears of Steel',poster:'https://img.youtube.com/vi/OHOpb2fS-cM/mqdefault.jpg',genre:'Sci-Fi',year:2012,description:'Scientists and warriors face a robotic threat.',video:'',youtubeId:'OHOpb2fS-cM',download:false},
    {id:3,title:'Sintel',poster:'https://commons.wikimedia.org/wiki/Special:FilePath/Sintel_poster.jpg',genre:'Fantasy',year:2010,description:'An epic animated fantasy adventure.',video:'https://media.w3.org/2010/05/sintel/trailer.mp4',download:true}
  ]}; }
}
function saveData(d) { fs.writeFileSync(DATA, JSON.stringify(d,null,2)); }

const sessions = new Map();

app.get('/api/movies', (req,res) => {
  const d=loadData();
  const q=String(req.query.q||'').toLowerCase();
  const genre=String(req.query.genre||'').toLowerCase();
  res.json(d.movies.filter(m=>
    (!q || (m.title+' '+m.genre+' '+m.description).toLowerCase().includes(q)) &&
    (!genre || m.genre.toLowerCase()===genre)
  ));
});

app.post('/api/register', (req,res) => {
  const username=String(req.body.username||'').trim();
  const password=String(req.body.password||'');
  if(username.length<3 || password.length<8)
    return res.status(400).json({error:'Username must have 3+ characters and password 8+.'});
  const d=loadData();
  if(d.users.some(u=>u.username.toLowerCase()===username.toLowerCase()))
    return res.status(409).json({error:'Username already exists.'});
  const salt=crypto.randomBytes(16).toString('hex');
  const hash=crypto.scryptSync(password,salt,64).toString('hex');
  d.users.push({id:crypto.randomUUID(),username,salt,hash,favorites:[]});
  saveData(d);
  res.json({message:'Account created. You can now log in.'});
});

app.post('/api/login', (req,res) => {
  const d=loadData();
  const username=String(req.body.username||'').toLowerCase();
  const user=d.users.find(u=>u.username.toLowerCase()===username);
  if(!user) return res.status(401).json({error:'Incorrect username or password.'});
  const hash=crypto.scryptSync(String(req.body.password||''),user.salt,64);
  const valid=crypto.timingSafeEqual(hash,Buffer.from(user.hash,'hex'));
  if(!valid) return res.status(401).json({error:'Incorrect username or password.'});
  const token=crypto.randomBytes(32).toString('hex');
  sessions.set(token,user.id);
  res.json({token,username:user.username,favorites:user.favorites});
});

function auth(req,res,next) {
  const token=(req.headers.authorization||'').replace(/^Bearer /,'');
  const userId=sessions.get(token);
  const d=loadData();
  const user=d.users.find(u=>u.id===userId);
  if(!user) return res.status(401).json({error:'Please log in first.'});
  req.user=user; next();
}

app.get('/api/me',auth,(req,res)=>res.json({
  username:req.user.username,favorites:req.user.favorites
}));

app.post('/api/favorites/:id',auth,(req,res)=>{
  const d=loadData();
  const user=d.users.find(u=>u.id===req.user.id);
  const id=Number(req.params.id);
  if(!d.movies.some(m=>m.id===id)) return res.status(404).json({error:'Movie not found.'});
  user.favorites=user.favorites.includes(id)
    ? user.favorites.filter(x=>x!==id) : [...user.favorites,id];
  saveData(d);
  res.json({favorites:user.favorites});
});

app.get('/api/download/:id',(req,res)=>{
  const d=loadData();
  const movie=d.movies.find(m=>m.id===Number(req.params.id));
  if(!movie) return res.status(404).send('Movie not found.');
  if(!movie.download) return res.status(403).send('Download is not permitted for this video.');
  res.redirect(movie.video);
});

app.get('/{*path}', (req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));

app.listen(PORT,'0.0.0.0',()=>{
  console.log(`JoshFlix running at http://127.0.0.1:${PORT}`);
});
