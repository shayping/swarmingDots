
/*global PIXI*/

// =============================================================================
// Dot matrix-esque renderer
var D = {
  init: function () {
    // Perform any resource loading prior to calling init.
    D.Display.init('.canvas');
   
    D.Display.render(function () {
      D.Swarm.render();
    });
    
  }
};


D.Display = (function() {
  var canvas,
      context,
      renderFn,
      requestFrame = window.requestAnimationFrame       ||
                     window.webkitRequestAnimationFrame ||
                     window.mozRequestAnimationFrame    ||
                     window.oRequestAnimationFrame      ||
                     window.msRequestAnimationFrame     ||
                     function(callback) {
                       window.setTimeout(callback, 1000 / 60);
                     };
  var app;
      
  return {
    init: function (el) {
      canvas = document.querySelector(el);
      context = canvas.getContext('2d');
      this.resizeCanvas();
    
      window.addEventListener('resize', function (e) {
        D.Display.resizeCanvas();
        //D.Display.resize();
      });
    },
    
    render: function (fn) {
      // The display is not a static display, I want to show minor mvt between
      // each frame, eg. once a shape has been drawn, I still want to have little
      // perturbations to give a more dynamic effect. Calling renderingLoop with 
      // with a new rendering function fn, will register the function and will 
      // allow that function to be called eachtime the browser repaints.
      renderFn = !renderFn ? fn : renderFn;
      this.clearDisplay();
      renderFn();
      requestFrame.call(window, this.render.bind(this));
    },

    resizeCanvas: function () {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    },
    
    
    clearDisplay: function () {
      context.clearRect(0, 0, canvas.width, canvas.height);
     // app.renderer.clear();
    },

    getDimensions: function () {
      return { w: canvas.width, h: canvas.height };
      //return {w : app.renderer.width, h: app.renderer.height};
    },

    drawPixel: function (fn) {
      // Each 'pixel' in Display isn't necessarily the same shape or size.
      // Each class that implements a pixel shape is responsible for providing
      // a function to draw itself, which will be passed into drawOject.
      fn(context);
    }
  }
}());

// ----------------------------------------------------------------------------
D.Color = function (r,g,b,a) {
  this.r = r;
  this.g = g;
  this.b = b;
  this.a = a;
};

D.Color.prototype = {
  render: function() {
    return 'rgba(' + this.r + ',' +  + this.g + ',' + this.b + ',' + this.a + ')';
  }
  
};


// -----------------------------------------------------------------------------
// A single pixel 
D.dot = 0;
D.hex = 1;
D.HexAngles = function() {
  var a = [ [Math.cos(0), Math.sin(0)] ];
  for (var s=0; s < 7; s++){
    a.push([Math.cos(s*2*Math.PI/6), Math.sin(s*2*Math.PI/6)]);
  }
  return a;
}();

D.Pixel = function(type, x, y, r, c) {
  // type = D.Dot, D.Hex 
  // x,y = center of pixel
  // r = radius 
  // c = D.color of pixel
  this.x = x;
  this.y = y;
  this.defaultColor = new D.Color(255,255,255,0.8);
  this.c = c ? c : this.defaultColor;
  this.r = r;
  this.type = type;
  
  this.nextPoint = {x:this.x, y:this.y};
  this.actionQ = [];
  this.talomere = -1;
  
  // Rougly how many ms I want transitons from src to dest to be
  // assuming browser can keep up with 60fps
  // Filled in by _animationSteps()
  this.transitonDelta = 1000;
  this.frameBudget = 0;
  this.transitionDxDy = [];
  this.wobble=[0,0];
}

D.Pixel.prototype = {
  move: function(p) {
    // I want to have the movement from origin to destination to take 
    // roughly the same number of iterations for each pixel, +- a small twiddle
    // This makes it easier to time transitions. 
    // Assume browser can keepup with 60fps
    p.frameBudget = Math.max(Math.floor((this.transitonDelta / 1000.0) * 60),2);
    
    // Queue up the request to move to position defined by p 
    this.actionQ.push({x: p.x, y: p.y, frameBudget: p.frameBudget});
    
    // Move could be either jsut x,y, or a Pixel. If it is the latter just
    // clone the value, probably I want to retire the pixel by setting talomere
    if (p instanceof D.Pixel) {
      this.talomere = p.talomere;
      this.r = p.r;
      //this.c = p.c;
      this.type = p.type;
      this.frameBudget = p.frameBudget;
    }
    
    if (p.hasOwnProperty('c')) {
      this.c = p.c;
    } else {
      this.c = this.defaultColor;
    }
    
  },
  
  render: function() {
    if (this.talomere != 0) {
      this._update();
      this._draw();
    }
  },
  
  distanceTo: function(p) {
    // calculates the distance from this pixel to the point p
    // Expects p to have .x and .y
    var dx = this.x - p.x,
        dy = this.y - p.y,
        d = Math.sqrt(dx * dx + dy * dy);
    return {dx:dx, dy:dy, d:d};    
  },
  
  _draw: function() {
    D.Display.drawPixel(function(context) {
      var x = this.x + this.wobble[0];
      var y = this.y + this.wobble[1];
      
      context.fillStyle = this.c.render();
      context.beginPath();
      switch (this.type) {
        case D.hex:
          context.moveTo(x + this.r * D.HexAngles[0][0], 
                         y + this.r * D.HexAngles[0][1]);
          for (var n=1; n<8; n++) {
            context.lineTo(x + this.r * D.HexAngles[n][0], 
                           y + this.r * D.HexAngles[n][1]);
          }
          break;
          
        case D.dot:
        default:
          context.arc(x, y, this.r, 0, 2 * Math.PI, true);
          break;
      }
      context.closePath(); 
      context.fill();
    }.bind(this))
  },
  
  _animationSteps: function(p) {
    // make all the animation steps from src to p,
    // plus or minus a little twiddle so things don't look so ridgid
    var steps = p.frameBudget + Math.floor((Math.random() - 0.5) * 30);
    var dist = this.distanceTo(p);
    var xd = Math.PI/2/steps;
    var yd = Math.PI/2/steps;
    this.transitionDxDy = [];
    for (var n=5; n<steps; n++) {
      var nx = Math.sin(n * xd) * dist.dx;
      var ny = Math.sin(n * yd) * dist.dy;
      this.transitionDxDy.push([
        this.x - nx,
        this.y - ny,
      ]);
    }
  },
  

  _shouldIStay: function() {
    // Or should I go now? If I go there will be trouble, 
    // if I stay I will just wobble.
    var nextFrame = this.transitionDxDy.shift();
    if (nextFrame) {
      this.x = nextFrame[0]; this.y = nextFrame[1];
      this.wobble = [0,0];
      return false;
    } else {
      // No more work! 
      // Time to wobble
      this.wobble = [
        Math.cos((Math.random()-0.5) * Math.PI),
        Math.cos((Math.random()-0.5) * Math.PI)
      ];
      
      return true;
    }
  },
  
  
  _update: function() {
    if (this._shouldIStay(this.nextPoint)) {
      // Ok I'm basically at nextPoint, so If there is a new location in actionQ
      // update nextPoint to that location
      var p = this.actionQ.shift();
      if (p) {
        this.nextPoint = p;
        this._animationSteps(p);
      } else {
        // Some wobbling already added by shouldIStay()
      }
    }
    if (this.talomere > 0) {
      //console.log('decrementing');
      this.talomere -= 1;
    }
  }
  
};

// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// Collecting a swarm of pixels into an 2D object
// SwarmBuilder is used to organize swarms of pixels into a pattern of some sort
D.SwarmBuilder = (function() {
  // SwarmBuilder is used to return a data structure that tells you how many
  // D.Pixel objects you need, and how ot organize them.
  
  // I want to have an invisible canvas to render into so I can use that to
  // extract out pixel locations
  var _canvas = document.createElement('canvas'),
      _context = _canvas.getContext('2d');

  var _fontFamily = 'Lato, Helvetica Neue, Helvetica, Arial, sans-serif';      
      
  // Step across the bitimage of the canvas to subsample down into 
  // a pixelated approximation of the canvas
  var radius = 5;
  var sample = (radius * 2) + 2;
 
  
  _resize();
  window.addEventListener('resize', _resize);
    
    
  function _resize() {
    _canvas.width = Math.floor(window.innerWidth / sample) * sample;
    _canvas.height = Math.floor(window.innerHeight / sample) * sample;
  }
  
  function _fitText(t) {
    // Given text t, I want to guess a fontSize to use
    var fz = 800;
    _context.font = 'bold ' + fz + 'px ' + _fontFamily;
    fz = Math.min(fz,
                  (_canvas.width / _context.measureText(t).width) * 0.7 * fz,
                  (_canvas.height / fz) * fz);
                  
    _context.font = 'bold ' + fz + 'px ' + _fontFamily;
  }
  
  function _clear() {
      _context.clearRect(0,0,_canvas.width, _canvas.height);
  }
  
  function _getSwarm(withColour) {
    // Returns an array of [ {x,y} ]
    var data = _context.getImageData(0,0, _canvas.width, _canvas.height).data;
    var pixelLocs = [],
        x = 0,
        y = 0;
    
    for (var n = 0; n < data.length; n += (4*sample) ) {
      var r = data[n],
          g = data[n+1],
          b = data[n+2],
          a = data[n+3];
      if (a > 0) {
        if (withColour){
          pixelLocs.push( {x: x, y: y, c: new D.Color(r,g,b,a/255.0)} );
        } else 
          pixelLocs.push( {x: x, y: y} );
      }
        
      x += sample;
      if (x >= (_canvas.width)) {
        x = 0; y += sample;
        n += (_canvas.width * 4 * sample);
      } 
    }
    return pixelLocs;
  }
  
  return {
    getRadius: function() {return radius},
    setRadius: function(r) {
        radius = r;
        sample = (radius * 2) + 2;
        _resize();
    },
    
    buildText: function(t) {
      if (t.length < 1) return;
      _context.fillStyle = 'red';
      _context.textBaseline = 'middle';
      _context.textAlign = 'center';
      _fitText(t);
      _clear();
      _context.fillText(t, _canvas.width/2 , _canvas.height/2 );
      return _getSwarm();
    },
    
    loadAndBuildImg: function(url, cb) {
      // Loading of image is async, so need to take in a callback to return 
      var image = new Image();
      image.onload = function() {
        cb(D.SwarmBuilder.buildImg(this));  
      };
      
      image.onerror = function() {
          cb(D.SwarmBuilder.buildText('wtf?'));
      }
      
      image.src = url;
    },
    
    buildImg: function(img) {
      var dim = D.Display.getDimensions();
      _clear();
      var w = Math.max(dim.h, dim.w) * 0.8;
      var h = Math.max(dim.h, dim.w) * 0.8;
      var x = (img.width > w) ? 0 : (w - img.width)/2;
      var y = (img.height > h) ? 0 : (h - img.height)/2;
      _context.drawImage(img,x,y,w,h);
      //_context.drawImage(img,0,0,dim.h * 0.75, dim.h *0.75);
      return _getSwarm(true);
    }
    
  }
}());


// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// Swarm is the main external interface into the pixels
D.Swarm = (function() {
  var pixels = [];
  var type = D.dot;
  
  function _birthPixel() {
    var dim = D.Display.getDimensions();
    var x = Math.random() * dim.w;
    var y = Math.random() * dim.h;
    return new D.Pixel(type, x, y, D.SwarmBuilder.getRadius());
  }
  
  function _retirePixel(prejudice) {
    var dim = D.Display.getDimensions();
    var x = Math.random() * dim.w;
    var y = Math.random() * dim.h;
    var r = Math.random() * 20 + D.SwarmBuilder.getRadius()/2;
    var d = new D.Pixel(D.hex, x, y, r, new D.Color(78,108,68, Math.random() * 0.2));
    var deathrate = (prejudice>0) ? prejudice : 200;
    d.talomere = Math.floor(Math.random() * deathrate + (deathrate/2));
    return d;
  }
  
  function _purgeRetired() {
    pixels = pixels.filter(p => p.talomere == -1); 
  }
  
  return {
    render: function() {
      if (pixels.length) {
        pixels = pixels.filter(p => p.talomere != 0);
        for (var n=0; n <pixels.length; n++) {
          pixels[n].render();
        }  
      }    
    },
    
    clear: function() {
      pixels = [];  
    },
    
    updateRadius: function(r) {
      D.SwarmBuilder.setRadius(r);
      pixels.map(p => p.r = r);
    },
    
    
    configureSwarm: function(swarm) {
      // Given a new swarm position s, (re)deploy D.Pixels to render 
      // the shape in the user viewable canvas.
      _purgeRetired();
      
      var l = swarm.length;
      
      var reuse = 0;
      var create = 0;
      var retire = 0;
      var t;
      
      // Reorder the pixels so the swarming looks more random
      pixels.sort(function(a,b) {  return (Math.random() > 0.5 ? 1 : -1) }); 
      pixels.sort(function(a,b) {  return (Math.random() > 0.5 ? 1 : -1) });
      
      if (l < pixels.length) {
        // There are more pixels than I need on screen
        reuse = l;
        retire = pixels.length;
        for (var n = 0; n < reuse; n++) {
          pixels[n].move(swarm[n]);
        }
        for (n = reuse; n < retire; n++) {
          // If there are too many pixels to retire, make some die faster.
          var prejudice = (retire-n) > 50 ? 50 : -1;
          pixels[n].move(_retirePixel(prejudice));
        }
        
      } else {
        // There aren't enough pixels on screen I need to create more.
        reuse = pixels.length;
        create = l; 
        
        for (var n = 0; n < reuse; n++) {
          pixels[n].move(swarm[n]);
        }
        for (n = reuse; n< create; n++) {
          t = _birthPixel();
          pixels.push(t);
          t.move(swarm[n]);
        }
      }
      //console.log('rendering ' + pixels.length + ' elements');
    },
    
    pulse: function(cb) {
      var newRadius = D.SwarmBuilder.getRadius() * 1.7;
      function pop(r) {
        pixels.map(p => p.r = r);
      };
      pop(newRadius);
      window.setTimeout(
        function(){
          pop(D.SwarmBuilder.getRadius());
          if (cb) cb();
        }, 300);
    },
    
    text: function(t) {
        var s = D.SwarmBuilder.buildText(t);
        D.Swarm.configureSwarm(s);
    },
    
    img: function(url, cb) {
      if (typeof url === 'string') {
        if (cb) {
          D.SwarmBuilder.loadAndBuildImg(url, function(s) {
            D.Swarm.configureSwarm(s);cb();
          });
        } else {
          D.SwarmBuilder.loadAndBuildImg(url, D.Swarm.configureSwarm);
        }
      } else {
        // Assume is an image object
        D.Swarm.configureSwarm(D.SwarmBuilder.buildImg(url));
      }
      
    }
  }    
}());


///---------------------------------------------------------------------------

D.Scripts = (function() {
  var scripts = [];
  var index = 0;
  var resources = {};
  var loading = 0;
  
  
  function _run() {
    if (index >= scripts.length) return;
    
    var timeout = scripts[index].timeout ? scripts[index].timeout : 4000;
    switch (scripts[index].cmd) {
      case 'text': 
        D.Swarm.text(scripts[index].value);
        window.setTimeout(function() {_run()}, timeout);
        break;
      case 'img' : 
        if (scripts[index].hasOwnProperty('id')) {
          D.Swarm.img(resources[scripts[index].id]);
          window.setTimeout(function() {_run()}, timeout);
        } else {
          D.Swarm.img(scripts[index].value, function() {
            window.setTimeout(function() {_run()}, timeout);
          });
        }
        break;
      case 'size': 
        D.Swarm.updateRadius(scripts[index].value);
        window.setTimeout(function() {_run()}, timeout);
        break;
      case 'pulse':
        D.Swarm.pulse(function(){
          window.setTimeout(function() {_run()}, timeout);
        });
        break;
      case 'play':
        resources[scripts[index].id].play();
        //if (scripts[index].from) {
        //  resources[scripts[index].id].currentTime = scripts[index].from;
        //}
        window.setTimeout(function() {_run()}, 300);
        break;
      case 'enable':
         document.body.addEventListener('keydown', function (e) {
           var input = document.querySelector('.ui-input')
           input.focus();
           if (e.keyCode === 13) {
             D.Swarm.text(input.value);
             input.value = '';
           }
          });
          break;
    }
    
    index +=1;
    
  }
  
  
  function _load(cb) {
    for (var n=0; n< scripts.length; n++) {
      switch (scripts[n].cmd) {
        case 'img':
          // Preload some resources for later use.
          resources[scripts[n].id] = new Image();
        
          resources[scripts[n].id].onload = function() {
            _loadDone(cb);
          };
          resources[scripts[n].id].onerror = function() {
            _loadDone(cb);
          }
          resources[scripts[n].id].src = scripts[n].url;
          break;
        case 'audio':
          resources[scripts[n].id] = new Audio();
        
          resources[scripts[n].id].onload = function() {
            _loadDone(cb);
          };
          resources[scripts[n].id].oncanplay = function() {
            _loadDone(cb);
          };
          
          resources[scripts[n].id].onerror = function() {
            _loadDone(cb);
          }
          resources[scripts[n].id].src = scripts[n].url;
          resources[scripts[n].id].load();
          break;
      }
    }
  }
  
  function _loadDone(cb) {
    loading -= 1;
    if (loading <= 0) cb();
  }
  
  
  
  return {
    // Run script
    run : function(s) {
      index = 0;
      scripts = s;
      _run();
    },
    
    // Preload resources
    load: function(s, cb) {
      loading = s.length;
      scripts = s;
      _load(cb);
    },
    
    r : function() {return resources}
  };
}())






// ----------------------------------------------------------------------------
function play() {
  D.init();

  D.Scripts.run([
    {cmd: 'play', id: 'track'},
    {cmd: 'size', value:6, timeout:300},
    {cmd: 'text', value:'Hello'},
    {cmd: 'text', value:'<(oo)>'},
    {cmd: 'text', value:"It's me"},
    
    {cmd: 'size', value:4, timeout:300},
    {cmd: 'img', id:'sps', timeout:6000},
    
    {cmd: 'size', value:6, timeout:300},
    {cmd: 'text', value:'Can you'},
    {cmd: 'text', value:'guess...'},
    
    {cmd: 'size', value:30, timeout:300},
    {cmd: 'img', id:'o1', timeout:8000},
    {cmd: 'size', value:6, timeout:300},
    {cmd: 'text', value:'???'},
    
    {cmd: 'size', value:20, timeout:300},
    {cmd: 'img', id:'o2', timeout:6000},
    
    {cmd: 'size', value:6, timeout:300},
    {cmd: 'text', value:'It is'},
    {cmd: 'text', value:'something'},
    {cmd: 'text', value:'in your home'},
    
    {cmd: 'size', value:15, timeout:300},
    {cmd: 'img', id:'o2', timeout:2000},
    {cmd: 'img', id:'o3', timeout:8000},
    
    {cmd: 'size', value:4, timeout:300},
    {cmd: 'text', value:'more resolution'},
    
    {cmd: 'img', id:'o4', timeout:5000},
    {cmd: 'size', value:5, timeout:5000},
    
    {cmd: 'size', value:4, timeout:300},
    {cmd: 'text', value:'Olympic Poster'},
    {cmd: 'text', value:'Bottom left'},
    {cmd: 'text', value:'behind'},
    {cmd: 'text', value:'Take a look...', timeout:3000},
    
    {cmd: 'size', value:2.5, timeout:300},
    {cmd: 'img', id:'contemplate', timeout: 10000},
    {cmd: 'img', id:'sps', timeout: 15000},
   
    {cmd: 'enable'}
  ]);
  
}

function ready() {
   var start = document.querySelector('.start');
   start.addEventListener('click', function (e) {
     start.classList.add('hidden');
     play();
   });
    
   start.classList.remove('hidden');
   document.body.classList.remove('loader');
   document.body.classList.add('ready');
}


function start() {
D.Scripts.load([
  {cmd:'audio',id:'track',url:'./Beethoven_7_2.mp3' },
  //{cmd:'img',id:'djw',url:'./djw4.png' },
  {cmd:'img',id:'sps',url:'./sps3.png' },
  {cmd:'img',id:'contemplate',url:'./contemplate.png' },
  {cmd:'img',id:'o1',url:'./o1.png' },
  {cmd:'img',id:'o2',url:'./o2.png' },
  {cmd:'img',id:'o3',url:'./o3.png' },
  {cmd:'img',id:'o4',url:'./o4.png' },
], ready);
}

start();