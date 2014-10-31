// Main perser class

'use strict';


var assign       = require('./common/utils').assign;
var isString     = require('./common/utils').isString;
var Renderer     = require('./renderer');
var ParserBlock  = require('./parser_block');
var ParserInline = require('./parser_inline');
var Ruler        = require('./ruler');
var parseRef     = require('./parser_ref');

var rule_linkify = require('./rules_text/linkify');
var rule_replace = require('./rules_text/replace');
var rule_smartquotes = require('./rules_text/smartquotes');

var config = {
  'default': require('./configs/default'),
  full: require('./configs/full'),
  commonmark: require('./configs/commonmark')
};


function StateCore(self, src, env) {
  this.src = src;
  this.env = env;
  this.options = self.options;
  this.tokens = [];

  this.inline = self.inline;
  this.block = self.block;
  this.renderer = self.renderer;
}

// Main class
//
function Remarkable(presetName, options) {
  var self = this;

  if (!options) {
    if (!isString(presetName)) {
      options = presetName || {};
      presetName = 'default';
    }
  }

  this.inline   = new ParserInline();
  this.block    = new ParserBlock();
  this.renderer = new Renderer();
  this.ruler    = new Ruler();

  this.options  = {};
  this.configure(config[presetName]);
  if (options) { this.set(options); }

  this.ruler.push('block', function block(state) {
    var tokens = self.block.parse(state.src, state.options, state.env);
    state.tokens = state.tokens.concat(tokens);
  });

  this.ruler.push('references', function references(state) {
    var tokens = state.tokens, i, l, content, pos;

    // Parse inlines
    for (i = 1, l = tokens.length - 1; i < l; i++) {
      if (tokens[i - 1].type === 'paragraph_open' &&
          tokens[i].type === 'inline' &&
          tokens[i + 1].type === 'paragraph_close') {

        content = tokens[i].content;
        while (content.length) {
          pos = parseRef(content, self.inline, state.options, state.env);
          if (pos < 0) { break; }
          content = content.slice(pos).trim();
        }

        tokens[i].content = content;
        if (!content.length) {
          tokens[i - 1].tight = true;
          tokens[i + 1].tight = true;
        }
      }
    }
  });

  this.ruler.push('inline', function inline(state) {
    var tokens = state.tokens, tok, i, l;

    // Parse inlines
    for (i = 0, l = tokens.length; i < l; i++) {
      tok = tokens[i];
      if (tok.type === 'inline') {
        tok.children = self.inline.parse(tok.content, state.options, state.env);
      }
    }
  });

  if (this.options.linkify) {
    this.ruler.push('linkify', rule_linkify);
  }

  if (this.options.typographer) {
    this.ruler.push('replace', rule_replace);
    this.ruler.push('smartquotes', rule_smartquotes);
  }
}


// Set options, if you did not passed those to constructor
//
Remarkable.prototype.set = function (options) {
  assign(this.options, options);
};


// Batch loader for components rules states & options
//
Remarkable.prototype.configure = function (presets) {
  var self = this;

  if (!presets) { throw new Error('Wrong config name'); }

  if (presets.options) { self.set(presets.options); }

  if (presets.components) {
    Object.keys(presets.components).forEach(function (name) {
      if (presets.components[name].rules) {
        self[name].ruler.enable(presets.components[name].rules, true);
      }
      if (presets.components[name].options) {
        self[name].set(presets.components[name].options);
      }
    });
  }
};


// Sugar for curried plugins init:
//
// var md = new Remarkable();
//
// md.use(plugin1)
//   .use(plugin2, opts)
//   .use(plugin3);
//
Remarkable.prototype.use = function (plugin, opts) {
  plugin(this, opts);
  return this;
};


// Parse input string, returns tokens array. Modify `env` with
// definitions data.
//
Remarkable.prototype.parse = function (src, env) {
  var i, len,
      rules = this.ruler.getRules(''),
      state = new StateCore(this, src, env);

  len = rules.length;

  for (i = 0; i < len; i++) {
    rules[i](state);
  }

  return state.tokens;
};

// Main method that does all magic :)
//
Remarkable.prototype.render = function (src) {
  var env = { references: {} };

  return this.renderer.render(this.parse(src, env), this.options, env);
};


module.exports = Remarkable;
