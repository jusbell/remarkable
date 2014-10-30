// Inline parser

'use strict';


var Ruler       = require('./ruler');
var StateInline = require('./rules_inline/state_inline');

////////////////////////////////////////////////////////////////////////////////
// Parser rules

var _rules = [
  [ 'text',       require('./rules_inline/text') ],
  [ 'newline',    require('./rules_inline/newline'),   { anchor: '\n' } ],
  [ 'escape',     require('./rules_inline/escape'),    { anchor: '\\' } ],
  [ 'backticks',  require('./rules_inline/backticks'), { anchor: '`' } ],
  [ 'del',        require('./rules_inline/del'),       { anchor: '~' } ],
  [ 'ins',        require('./rules_inline/ins'),       { anchor: '+' } ],
  [ 'mark',       require('./rules_inline/mark'),      { anchor: '=' } ],
  [ 'emphasis',   require('./rules_inline/emphasis'),  { anchor: [ '*', '_' ] } ],
  [ 'sub',        require('./rules_inline/sub'),       { anchor: '~' } ],
  [ 'sup',        require('./rules_inline/sup'),       { anchor: '^' } ],
  [ 'links',      require('./rules_inline/links'),     { anchor: [ '!', '[' ] } ],
  [ 'autolink',   require('./rules_inline/autolink'),  { anchor: '<' } ],
  [ 'htmltag',    require('./rules_inline/htmltag'),   { anchor: '<' } ],
  [ 'entity',     require('./rules_inline/entity'),    { anchor: '&' } ]
];


var BAD_PROTOCOLS = [ 'vbscript', 'javascript', 'file' ];

function validateLink(url) {
  var str = '';

  try {
    str = decodeURI(url).trim().toLowerCase();
  } catch (_) {}

  if (!str) { return false; }

  if (str.indexOf(':') >= 0 && BAD_PROTOCOLS.indexOf(str.split(':')[0]) >= 0) {
    return false;
  }
  return true;
}

// Inline Parser class
//
function ParserInline() {

  // Rule to skip pure text
  // - '{}$%@+=:' reserved for extentions
  this.textMatch = /[\n\\`*_^\[\]!&<{}$%@~+=:]/;

  // By default CommonMark allows too much in links
  // If you need to restrict it - override this with your validator.
  this.validateLink = validateLink;

  this.ruler = new Ruler();

  var anchor;

  for (var i = 0; i < _rules.length; i++) {
    anchor = (_rules[i][2] || {}).anchor || [];
    anchor = Array.isArray(anchor) ? anchor : [ anchor ];
    /*eslint no-loop-func:0*/
    anchor = anchor.map(function (val) { return val.charCodeAt(0); });
    this.ruler.push(_rules[i][0], _rules[i][1], { anchor: anchor });
  }
}


// Skip single token by running all rules in validation mode;
// returns `true` if any rule reported success
//
ParserInline.prototype.skipToken = function (state) {
  var i, cached_pos, pos = state.pos,
      rules, len;

  if ((cached_pos = state.cacheGet(pos)) > 0) {
    state.pos = cached_pos;
    return;
  }

  rules = this.ruler.getAnchoredRules('', state.src.charCodeAt(pos));
  len = rules.length;

  for (i = 0; i < len; i++) {
    if (rules[i](state, true)) {
      state.cacheSet(pos, state.pos);
      return;
    }
  }

  state.pos++;
  state.cacheSet(pos, state.pos);
};


// Generate tokens for input range
//
ParserInline.prototype.tokenize = function (state) {
  var ok, i,
      rules,
      len,
      end = state.posMax;

  while (state.pos < end) {

    // Try all possible rules.
    // On success, rule should:
    //
    // - update `state.pos`
    // - update `state.tokens`
    // - return true

    rules = this.ruler.getAnchoredRules('', state.src.charCodeAt(state.pos));
    len = rules.length;

    for (i = 0; i < len; i++) {
      ok = rules[i](state, false);
      if (ok) { break; }
    }

    if (ok) {
      if (state.pos >= end) { break; }
      continue;
    }

    state.pending += state.src[state.pos++];
  }

  if (state.pending) {
    state.pushPending();
  }

  return state.tokens;
};


// Parse input string.
//
ParserInline.prototype.parse = function (str, options, env) {
  var state = new StateInline(str, this, options, env);

  this.tokenize(state);

  if (options.linkify) {
    this.linkifier.process(state);
  }
  if (options.typographer) {
    this.typographer.process(state);
  }

  return state.tokens;
};


module.exports = ParserInline;
