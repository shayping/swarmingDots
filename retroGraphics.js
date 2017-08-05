

// =============================================================================
// Dot matrix-esque renderer

var D = {
  init: function () {
    D.Display.init('.canvas');
    document.body.classList.add('body--ready');

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
  return {
    init: function (el) {
      canvas = document.querySelector(el);
      context = canvas.getContext('2d');
      this.resizeCanvas();

      window.addEventListener('resize', function (e) {
        D.Display.resizeCanvas();
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
    },

    getDimensions: function () {
      return { w: canvas.width, h: canvas.height };
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
  this.c = c ? c : new D.Color(255,255,255,0.8);
  this.r = r;
  this.type = type;
  
  this.nextPoint = {x:this.x, y:this.y};
  this.actionQ = [];
  this.talomere = -1;
}

D.Pixel.prototype = {
  move: function(p) {
    // Queue up the request to move to position defined by p  
    this.actionQ.push({x: p.x, y: p.y});
    
    // Move could be either jsut x,y, or a Pixel. If it is the latter just
    // clone the value, probably I want to retire the pixel by setting talomere
    if (p instanceof D.Pixel) {
      this.talomere = p.talomere;
      this.r = p.r;
      this.c = p.c;
      this.type = p.type;
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
      context.fillStyle = this.c.render();
      context.beginPath();
      switch (this.type) {
        case D.hex:
          context.moveTo(this.x + this.r * D.HexAngles[0][0], 
                         this.y + this.r * D.HexAngles[0][1]);
          for (var n=1; n<8; n++) {
            context.lineTo(this.x + this.r * D.HexAngles[n][0], 
                         this.y + this.r * D.HexAngles[n][1]);
          }
          break;
          
        case D.dot:
        default:
          context.arc(this.x, this.y, this.r, 0, 2 * Math.PI, true);
          break;
      }
      context.closePath(); 
      context.fill();
    }.bind(this))
  },
  
  _easeFactor: function(dist) {
    if (dist.d > 400) return 20;
    if (dist.d > 300) return 10;
    if (dist.d > 200) return 8;
    if (dist.d > 50) return 4;
    if (dist.d > 20) return 1.5;
    if (dist.d > 8) return 1;
    return 0.7;
  },
  
  _shouldIStay: function(p) {
    // Or should I go now? If I go there will be trouble, 
    // if I stay I will just wobble.
    var dist = this.distanceTo(p);
    
    if (dist.d > 1) {
      var dxd = (dist.dx / dist.d);
      var dyd = (dist.dy / dist.d);
      this.x -= (dxd * this._easeFactor(dist));
      this.y -= (dyd * this._easeFactor(dist));
      return false;
    }
    
    // wobbling
    this.x += Math.cos((Math.random()-0.5) * Math.PI);
    this.y += Math.cos((Math.random()-0.5) * Math.PI);
    return true;
  },
  
  _update: function() {
    if (this._shouldIStay(this.nextPoint)) {
      // Ok I'm basically at nextPoint, so If there is a new location in actionQ
      // update nextPoint to that location
      var p = this.actionQ.shift();
      if (p) {
        this.nextPoint = p;
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
    console.log('')
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
  
  function _getSwarm() {
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
    
    buildImg: function(url, cb) {
      // Loading of image is async, so need to take in a callback to return 
      var image = new Image();
      image.onload = function() {
          var dim = D.Display.getDimensions();
          _clear();
          _context.drawImage(this,0,0,dim.h * 0.75, dim.h *0.75);
          cb(_getSwarm());
      };
      
      image.onerror = function() {
          cb(D.SwarmBuilder.buildText('wtf?'));
      }
      
      image.src = url;
    }
    
  }
}());


// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
D.Swarm = (function() {
  var pixels = [];
  var type = D.hex;
  
  function _birthPixel() {
    var dim = D.Display.getDimensions();
    var x = Math.random() * dim.w;
    var y = Math.random() * dim.h;
    return new D.Pixel(type, x, y, D.SwarmBuilder.getRadius());
  }
  
  function _retirePixel() {
    var dim = D.Display.getDimensions();
    var x = Math.random() * dim.w;
    var y = Math.random() * dim.h;
    var r = Math.random() * 20 + D.SwarmBuilder.getRadius()/2;
    var d = new D.Pixel(type, x, y, r, new D.Color(78,108,68, Math.random() * 0.2));
    d.talomere = Math.floor(Math.random() * 200) + 100;
    
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
          pixels[n].move(_retirePixel());
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
      if (cb) {
        D.SwarmBuilder.buildImg(url, function(s) {
          D.Swarm.configureSwarm(s);cb();
        });
      } else {
        D.SwarmBuilder.buildImg(url, D.Swarm.configureSwarm);
      }
    }
  }    
}());


///---------------------------------------------------------------------------

D.Scripts = (function() {
  var scripts = [];
  var index = 0;
  
  
  function _run() {
    if (index >= scripts.length) return;
    
    var timeout = scripts[index].timeout ? scripts[index].timeout : 4000;
    switch (scripts[index].cmd) {
      case 'text': 
        D.Swarm.text(scripts[index].value);
        if (index <= scripts.length)
          window.setTimeout(function() {_run()}, timeout);
        break;
      case 'img' : 
        D.Swarm.img(scripts[index].value, function() {
          if (index <= scripts.length)
          window.setTimeout(function() {_run()}, timeout);
        });
        break;
      case 'size': 
        D.Swarm.updateRadius(scripts[index].value);
        if (index <= scripts.length)
          window.setTimeout(function() {_run()}, timeout);
        break;
      case 'pulse':
        D.Swarm.pulse(function(){
          if (index <= scripts.length)
            window.setTimeout(function() {_run()}, timeout);
        });
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
  
  return {
    run : function(s) {
      index = 0;
      scripts = s;
      _run();
    }
  };
}())






// ----------------------------------------------------------------------------
D.init();




D.Scripts.run([
  {cmd: 'text', value:'Hello'},
  {cmd: 'text', value:"It's me"},
  {cmd: 'size', value:4, timeout:300},
  {cmd: 'img', value:'./sps.png'},
  {cmd: 'size', value:6, timeout:300},
  {cmd: 'text', value:"So..."},
  {cmd: 'size', value:4, timeout:300},
  {cmd: 'text', value:"Here's wishing you"},
  {cmd: 'pulse'},
  {cmd: 'text', value:'Happy Birthday!', timeout:5000},
  {cmd: 'size', value:2, timeout:300},
  {cmd: 'text', value:'<(oo)> '},
  {cmd: 'img', value:'./djw4.png',timeout:10000},
  {cmd: 'size', value:4, timeout:5000},
  {cmd: 'text', value:'Type...'},
  {cmd: 'enable'}
  ]);


