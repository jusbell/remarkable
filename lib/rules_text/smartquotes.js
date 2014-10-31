// Convert straight quotation marks to typographic ones
//
'use strict';


var QUOTE_TEST_RE = /['"]/;
var QUOTE_RE = /['"]/g;
var PUNCT_RE = /[-\s()\[\]]/;
var APOSTROPHE = '’';

// This function returns true if the character at `pos`
// could be inside a word.
function isLetter(str, pos) {
  if (pos < 0 || pos >= str.length) { return false; }
  return !PUNCT_RE.test(str[pos]);
}


function replaceAt(str, index, ch) {
  return str.substr(0, index) + ch + str.substr(index + 1);
}

var stack = [];

module.exports = function smartquotes(state) {
  /*eslint max-depth:0*/
  var i, l, token, text, t, pos, max, thisLevel, lastSpace, nextSpace,
      item, canOpen, canClose, j, k, isSingle, chars, tokens,
      blockTokens = state.tokens,
      options = state.options;

  for (j = 0, l = blockTokens.length; j < l; j++) {
    if (blockTokens[j].type !== 'inline') { continue; }
    tokens = blockTokens[j].children;

    stack.length = 0;

    for (i = 0; i < tokens.length; i++) {
      token = tokens[i];

      if (token.type !== 'text' || QUOTE_TEST_RE.test(token.text)) { continue; }

      thisLevel = tokens[i].level;

      for (k = stack.length - 1; k >= 0; k--) {
        if (stack[k].level <= thisLevel) { break; }
      }
      stack.length = k + 1;

      text = token.content;
      pos = 0;
      max = text.length;

      /*eslint no-labels:0,block-scoped-var:0*/
      OUTER:
      while (pos < max) {
        QUOTE_RE.lastIndex = pos;
        t = QUOTE_RE.exec(text);
        if (!t) { break; }

        lastSpace = !isLetter(text, t.index - 1);
        pos = t.index + 1;
        isSingle = (t[0] === "'");
        nextSpace = !isLetter(text, pos);

        if (!nextSpace && !lastSpace) {
          // middle of word
          if (isSingle) {
            token.content = replaceAt(token.content, t.index, APOSTROPHE);
          }
          continue;
        }

        canOpen = !nextSpace;
        canClose = !lastSpace;

        if (canClose) {
          // this could be a closing quote, rewind the stack to get a match
          for (k = stack.length - 1; k >= 0; k--) {
            item = stack[k];
            if (stack[k].level < thisLevel) { break; }
            if (item.single === isSingle && stack[k].level === thisLevel) {
              item = stack[k];
              chars = isSingle ? options.singleQuotes : options.doubleQuotes;
              if (chars) {
                tokens[item.token].content = replaceAt(tokens[item.token].content, item.pos, chars[0]);
                token.content = replaceAt(token.content, t.index, chars[1]);
              }
              stack.length = k;
              continue OUTER;
            }
          }
        }

        if (canOpen) {
          stack.push({
            token: i,
            pos: t.index,
            single: isSingle,
            level: thisLevel
          });
        } else if (canClose && isSingle) {
          token.content = replaceAt(token.content, t.index, APOSTROPHE);
        }
      }
    }
  }
};
