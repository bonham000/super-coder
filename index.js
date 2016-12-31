'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactDom = require('react-dom');

var _reactDom2 = _interopRequireDefault(_reactDom);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var codeString = '\nmodule.exports = AutoFocusUtils; \n},{"155":155,"41":41}],2:[function(_dereq_,module,exports){\n/**\n * Copyright 2013-present Facebook, Inc.\n * All rights reserved.\n *\n * This source code is licensed under the BSD-style license found in the\n * LICENSE file in the root directory of this source tree. An additional grant\n * of patent rights can be found in the PATENTS file in the same directory.\n *\n * @providesModule BeforeInputEventPlugin\n */\n\n\'use strict\';\n\nvar EventConstants = _dereq_(16);\nvar EventPropagators = _dereq_(20);\nvar ExecutionEnvironment = _dereq_(147);\nvar FallbackCompositionState = _dereq_(21);\nvar SyntheticCompositionEvent = _dereq_(102);\nvar SyntheticInputEvent = _dereq_(106);\n\nvar keyOf = _dereq_(165);\n\nvar END_KEYCODES = [9, 13, 27, 32]; // Tab, Return, Esc, Space\nvar START_KEYCODE = 229;\n\nvar canUseCompositionEvent = ExecutionEnvironment.canUseDOM && \'CompositionEvent\' in window;\n\nvar documentMode = null;\nif (ExecutionEnvironment.canUseDOM && \'documentMode\' in document) {\n  documentMode = document.documentMode;\n}\n\n// Webkit offers a very useful textInput event that can be used to\n// directly represent beforeInput. The IE textinput event is not as\n// useful, so we don\'t use it.\nvar canUseTextInputEvent = ExecutionEnvironment.canUseDOM && \'TextEvent\' in window && !documentMode && !isPresto();\n\n// In IE9+, we have access to composition events, but the data supplied\n// by the native compositionend event may be incorrect. Japanese ideographic\n// spaces, for instance () are not recorded correctly.\nvar useFallbackCompositionData = ExecutionEnvironment.canUseDOM && (!canUseCompositionEvent || documentMode && documentMode > 8 && documentMode <= 11);\n\n/**\n * Opera <= 12 includes TextEvent in window, but does not fire\n * text input events. Rely on keypress instead.\n */\nfunction isPresto() {\n  var opera = window.opera;\n  return typeof opera === \'object\' && typeof opera.version === \'function\' && parseInt(opera.version(), 10) <= 12;\n}\n\nvar SPACEBAR_CODE = 32;\nvar SPACEBAR_CHAR = String.fromCharCode(SPACEBAR_CODE);\n\nvar topLevelTypes = EventConstants.topLevelTypes;\n\n// Events and their corresponding property names.\nvar eventTypes = {\n  beforeInput: {\n    phasedRegistrationNames: {\n      bubbled: keyOf({ onBeforeInput: null }),\n      captured: keyOf({ onBeforeInputCapture: null })\n    },\n    dependencies: [topLevelTypes.topCompositionEnd, topLevelTypes.topKeyPress, topLevelTypes.topTextInput, topLevelTypes.topPaste]\n  },\n  compositionEnd: {\n    phasedRegistrationNames: {\n      bubbled: keyOf({ onCompositionEnd: null }),\n      captured: keyOf({ onCompositionEndCapture: null })\n    },\n    dependencies: [topLevelTypes.topBlur, topLevelTypes.topCompositionEnd, topLevelTypes.topKeyDown, topLevelTypes.topKeyPress, topLevelTypes.topKeyUp, topLevelTypes.topMouseDown]\n  },\n  compositionStart: {\n    phasedRegistrationNames: {\n      bubbled: keyOf({ onCompositionStart: null }),\n      captured: keyOf({ onCompositionStartCapture: null })\n    },\n    dependencies: [topLevelTypes.topBlur, topLevelTypes.topCompositionStart, topLevelTypes.topKeyDown, topLevelTypes.topKeyPress, topLevelTypes.topKeyUp, topLevelTypes.topMouseDown]\n  },\n  compositionUpdate: {\n    phasedRegistrationNames: {\n      bubbled: keyOf({ onCompositionUpdate: null }),\n      captured: keyOf({ onCompositionUpdateCapture: null })\n    },\n    dependencies: [topLevelTypes.topBlur, topLevelTypes.topCompositionUpdate, topLevelTypes.topKeyDown, topLevelTypes.topKeyPress, topLevelTypes.topKeyUp, topLevelTypes.topMouseDown]\n  }\n};\n\n// Track whether we\'ve ever handled a keypress on the space key.\nvar hasSpaceKeypress = false;\n\n/**\n * Return whether a native keypress event is assumed to be a command.\n * This is required because Firefox fires keypress events for key commands\n * (cut, copy, select-all, etc.) even though no character is inserted.\n */\nfunction isKeypressCommand(nativeEvent) {\n  return (nativeEvent.ctrlKey || nativeEvent.altKey || nativeEvent.metaKey) &&\n  // ctrlKey && altKey is equivalent to AltGr, and is not a command.\n  !(nativeEvent.ctrlKey && nativeEvent.altKey);\n}\n\n/**\n * Translate native top level events into event types.\n *\n * @param {string} topLevelType\n * @return {object}\n */\nfunction getCompositionEventType(topLevelType) {\n  switch (topLevelType) {\n    case topLevelTypes.topCompositionStart:\n      return eventTypes.compositionStart;\n    case topLevelTypes.topCompositionEnd:\n      return eventTypes.compositionEnd;\n    case topLevelTypes.topCompositionUpdate:\n      return eventTypes.compositionUpdate;\n  }\n}\n\n/**\n * Does our fallback best-guess model think this event signifies that\n * composition has begun?\n *\n * @param {string} topLevelType\n * @param {object} nativeEvent\n * @return {boolean}\n */\nfunction isFallbackCompositionStart(topLevelType, nativeEvent) {\n  return topLevelType === topLevelTypes.topKeyDown && nativeEvent.keyCode === START_KEYCODE;\n}\n\n/**\n * Does our fallback mode think that this event is the end of composition?\n *\n * @param {string} topLevelType\n * @param {object} nativeEvent\n * @return {boolean}\n */\nfunction isFallbackCompositionEnd(topLevelType, nativeEvent) {\n  switch (topLevelType) {\n    case topLevelTypes.topKeyUp:\n      // Command keys insert or clear IME input.\n      return END_KEYCODES.indexOf(nativeEvent.keyCode) !== -1;\n    case topLevelTypes.topKeyDown:\n      // Expect IME keyCode on each keydown. If we get any other\n      // code we must have exited earlier.\n      return nativeEvent.keyCode !== START_KEYCODE;\n    case topLevelTypes.topKeyPress:\n    case topLevelTypes.topMouseDown:\n    case topLevelTypes.topBlur:\n      // Events are not possible without cancelling IME.\n      return true;\n    default:\n      return false;\n  }\n}\n\n/**\n * Google Input Tools provides composition data via a CustomEvent,\n * with the data property populated in the detail object. If this\n * is available on the event object, use it. If not, this is a plain\n * composition event and we have nothing special to extract.\n *\n * @param {object} nativeEvent\n * @return {?string}\n */\nfunction getDataFromCustomEvent(nativeEvent) {\n  var detail = nativeEvent.detail;\n  if (typeof detail === \'object\' && \'data\' in detail) {\n    return detail.data;\n  }\n  return null;\n}\n\n// Track the current IME composition fallback object, if any.\nvar currentComposition = null;\n\n/**\n * @return {?object} A SyntheticCompositionEvent.\n */\nfunction extractCompositionEvent(topLevelType, targetInst, nativeEvent, nativeEventTarget) {\n  var eventType;\n  var fallbackData;\n\n  if (canUseCompositionEvent) {\n    eventType = getCompositionEventType(topLevelType);\n  } else if (!currentComposition) {\n    if (isFallbackCompositionStart(topLevelType, nativeEvent)) {\n      eventType = eventTypes.compositionStart;\n    }\n  } else if (isFallbackCompositionEnd(topLevelType, nativeEvent)) {\n    eventType = eventTypes.compositionEnd;\n  }\n\n  if (!eventType) {\n    return null;\n  }\n\n  if (useFallbackCompositionData) {\n    // The current composition is stored statically and must not be\n    // overwritten while composition continues.\n    if (!currentComposition && eventType === eventTypes.compositionStart) {\n      currentComposition = FallbackCompositionState.getPooled(nativeEventTarget);\n    } else if (eventType === eventTypes.compositionEnd) {\n      if (currentComposition) {\n        fallbackData = currentComposition.getData();\n      }\n    }\n  }\n\n  var event = SyntheticCompositionEvent.getPooled(eventType, targetInst, nativeEvent, nativeEventTarget);\n\n  if (fallbackData) {\n    // Inject data generated from fallback path into the synthetic event.\n    // This matches the property of native CompositionEventInterface.\n    event.data = fallbackData;\n  } else {\n    var customData = getDataFromCustomEvent(nativeEvent);\n    if (customData !== null) {\n      event.data = customData;\n    }\n  }\n\n  EventPropagators.accumulateTwoPhaseDispatches(event);\n  return event;\n}\n\n/**\n * @param {string} topLevelType Record from EventConstants.\n * @param {object} nativeEvent Native browser event.\n * @return {?string} The string corresponding to this beforeInput event.\n */\nfunction getNativeBeforeInputChars(topLevelType, nativeEvent) {\n  switch (topLevelType) {\n    case topLevelTypes.topCompositionEnd:\n      return getDataFromCustomEvent(nativeEvent);\n    case topLevelTypes.topKeyPress:\n      /**\n       * If native textInput events are available, our goal is to make\n       * use of them. However, there is a special case: the spacebar key.\n       * In Webkit, preventing default on a spacebar textInput event\n       * cancels character insertion, but it *also* causes the browser\n       * to fall back to its default spacebar behavior of scrolling the\n       * page.\n       *\n       * Tracking at:\n       * https://code.google.com/p/chromium/issues/detail?id=355103\n       *\n       * To avoid this issue, use the keypress event as if no textInput\n       * event is available.\n       */\n      var which = nativeEvent.which;\n      if (which !== SPACEBAR_CODE) {\n        return null;\n      }\n\n      hasSpaceKeypress = true;\n      return SPACEBAR_CHAR;\n\n    case topLevelTypes.topTextInput:\n      // Record the characters to be added to the DOM.\n      var chars = nativeEvent.data;\n\n      // If it\'s a spacebar character, assume that we have already handled\n      // it at the keypress level and bail immediately. Android Chrome\n      // doesn\'t give us keycodes, so we need to blacklist it.\n      if (chars === SPACEBAR_CHAR && hasSpaceKeypress) {\n        return null;\n      }\n\n      return chars;\n\n    default:\n      // For other native event types, do nothing.\n      return null;\n  }\n}\n\n/**\n * For browsers that do not provide the textInput event, extract the\n * appropriate string to use for SyntheticInputEvent.\n *\n * @param {string} topLevelType Record from EventConstants.\n * @param {object} nativeEvent Native browser event.\n * @return {?string} The fallback string for this beforeInput event.\n */\nfunction getFallbackBeforeInputChars(topLevelType, nativeEvent) {\n  // If we are currently composing (IME) and using a fallback to do so,\n  // try to extract the composed characters from the fallback object.\n  if (currentComposition) {\n    if (topLevelType === topLevelTypes.topCompositionEnd || isFallbackCompositionEnd(topLevelType, nativeEvent)) {\n      var chars = currentComposition.getData();\n      FallbackCompositionState.release(currentComposition);\n      currentComposition = null;\n      return chars;\n    }\n    return null;\n  }\n\n  switch (topLevelType) {\n    case topLevelTypes.topPaste:\n      // If a paste event occurs after a keypress, throw out the input\n      // chars. Paste events should not lead to BeforeInput events.\n      return null;\n    case topLevelTypes.topKeyPress:\n      /**\n       * As of v27, Firefox may fire keypress events even when no character\n       * will be inserted. A few possibilities:\n       *\n       * - which is 0. Arrow keys, Esc key, etc.\n       *\n       * - which is the pressed key code, but no char is available.\n       *   Ex: \'AltGr + d in Polish. There is no modified character for\n       *   this key combination and no character is inserted into the\n       *   document, but FF fires the keypress for char code 100 anyway.\n       *   No input event will occur.\n       *\n       * - which is the pressed key code, but a command combination is\n       *   being used. Ex: Cmd+C. No character is inserted, and no\n       *   input event will occur.\n       */\n      if (nativeEvent.which && !isKeypressCommand(nativeEvent)) {\n        return String.fromCharCode(nativeEvent.which);\n      }\n      return null;\n    case topLevelTypes.topCompositionEnd:\n      return useFallbackCompositionData ? null : nativeEvent.data;\n    default:\n      return null;\n  }\n}\n\n/**\n * Extract a SyntheticInputEvent for beforeInput, based on either native\n * textInput or fallback behavior.\n *\n * @return {?object} A SyntheticInputEvent.\n */\nfunction extractBeforeInputEvent(topLevelType, targetInst, nativeEvent, nativeEventTarget) {\n  var chars;\n\n  if (canUseTextInputEvent) {\n    chars = getNativeBeforeInputChars(topLevelType, nativeEvent);\n  } else {\n    chars = getFallbackBeforeInputChars(topLevelType, nativeEvent);\n  }\n\n  // If no characters are being inserted, no BeforeInput event should\n  // be fired.\n  if (!chars) {\n    return null;\n  }\n\n  var event = SyntheticInputEvent.getPooled(eventTypes.beforeInput, targetInst, nativeEvent, nativeEventTarget);\n\n  event.data = chars;\n  EventPropagators.accumulateTwoPhaseDispatches(event);\n  return event;\n}\n\n/**\n * Create an onBeforeInput event to match\n * http://www.w3.org/TR/2013/WD-DOM-Level-3-Events-20131105/#events-inputevents.\n *\n * This event plugin is based on the native textInput event\n * available in Chrome, Safari, Opera, and IE. This event fires after\n * onKeyPress and onCompositionEnd, but before onInput.\n *\n * beforeInput is spec\'d but not implemented in any browsers, and\n * the input event does not provide any useful information about what has\n * actually been added, contrary to the spec. Thus, textInput is the best\n * available event to identify the characters that have actually been inserted\n * into the target node.\n *\n * This plugin is also responsible for emitting composition events, thus\n * allowing us to share composition fallback code for both beforeInput and\n * composition event types.\n */\nvar BeforeInputEventPlugin = {\n\n  eventTypes: eventTypes,\n\n  extractEvents: function (topLevelType, targetInst, nativeEvent, nativeEventTarget) {\n    return [extractCompositionEvent(topLevelType, targetInst, nativeEvent, nativeEventTarget), extractBeforeInputEvent(topLevelType, targetInst, nativeEvent, nativeEventTarget)];\n  }\n};\n\nmodule.exports = BeforeInputEventPlugin;\n},{"102":102,"106":106,"147":147,"16":16,"165":165,"20":20,"21":21}],3:[function(_dereq_,module,exports){\n/**\n * Copyright 2013-present, Facebook, Inc.\n * All rights reserved.\n *\n * This source code is licensed under the BSD-style license found in the\n * LICENSE file in the root directory of this source tree. An additional grant\n * of patent rights can be found in the PATENTS file in the same directory.\n *\n * @providesModule CSSProperty\n */\n\n\'use strict\';\n\n/**\n * CSS properties which accept numbers but are not in units of "px".\n */\n\nvar isUnitlessNumber = {\n  animationIterationCount: true,\n  borderImageOutset: true,\n  borderImageSlice: true,\n  borderImageWidth: true,\n  boxFlex: true,\n  boxFlexGroup: true,\n  boxOrdinalGroup: true,\n  columnCount: true,\n  flex: true,\n  flexGrow: true,\n  flexPositive: true,\n  flexShrink: true,\n  flexNegative: true,\n  flexOrder: true,\n  gridRow: true,\n  gridColumn: true,\n  fontWeight: true,\n  lineClamp: true,\n  lineHeight: true,\n  opacity: true,\n  order: true,\n  orphans: true,\n  tabSize: true,\n  widows: true,\n  zIndex: true,\n  zoom: true,\n\n  // SVG-related properties\n  fillOpacity: true,\n  floodOpacity: true,\n  stopOpacity: true,\n  strokeDasharray: true,\n  strokeDashoffset: true,\n  strokeMiterlimit: true,\n  strokeOpacity: true,\n  strokeWidth: true\n};\n\n/**\n * @param {string} prefix vendor-specific prefix, eg: Webkit\n * @param {string} key style name, eg: transitionDuration\n * @return {string} style name prefixed with prefix, properly camelCased, eg:\n * WebkitTransitionDuration\n */\nfunction prefixKey(prefix, key) {\n  return prefix + key.charAt(0).toUpperCase() + key.substring(1);\n}\n\n/**\n * Support style names that may come passed in prefixed by adding permutations\n * of vendor prefixes.\n */\nvar prefixes = [\'Webkit\', \'ms\', \'Moz\', \'O\'];\n\n// Using Object.keys here, or else the vanilla for-in loop makes IE8 go into an\n// infinite loop, because it iterates over the newly added props too.\nObject.keys(isUnitlessNumber).forEach(function (prop) {\n  prefixes.forEach(function (prefix) {\n    isUnitlessNumber[prefixKey(prefix, prop)] = isUnitlessNumber[prop];\n  });\n});\n\n/**\n * Most style properties can be unset by doing .style[prop] = \'\' but IE8\n * doesn\'t like doing that with shorthand properties so for the properties that\n * IE8 breaks on, which are listed here, we instead unset each of the\n * individual properties. See http://bugs.jquery.com/ticket/12385.\n * The 4-value \'clock\' properties like margin, padding, border-width seem to\n * behave without any problems. Curiously, list-style works too without any\n * special prodding.\n */\nvar shorthandPropertyExpansions = {\n  background: {\n    backgroundAttachment: true,\n    backgroundColor: true,\n    backgroundImage: true,\n    backgroundPositionX: true,\n    backgroundPositionY: true,\n    backgroundRepeat: true\n  },\n  backgroundPosition: {\n    backgroundPositionX: true,\n    backgroundPositionY: true\n  },\n  border: {\n    borderWidth: true,\n    borderStyle: true,\n    borderColor: true\n  },\n  borderBottom: {\n    borderBottomWidth: true,\n    borderBottomStyle: true,\n    borderBottomColor: true\n  },\n  borderLeft: {\n    borderLeftWidth: true,\n    borderLeftStyle: true,\n    borderLeftColor: true\n  },\n  borderRight: {\n    borderRightWidth: true,\n    borderRightStyle: true,\n    borderRightColor: true\n  },\n  borderTop: {\n    borderTopWidth: true,\n    borderTopStyle: true,\n    borderTopColor: true\n  },\n  font: {\n    fontStyle: true,\n    fontVariant: true,\n    fontWeight: true,\n    fontSize: true,\n    lineHeight: true,\n    fontFamily: true\n  },\n  outline: {\n    outlineWidth: true,\n    outlineStyle: true,\n    outlineColor: true\n  }\n};\n\nvar CSSProperty = {\n  isUnitlessNumber: isUnitlessNumber,\n  shorthandPropertyExpansions: shorthandPropertyExpansions\n};\n\nmodule.exports = CSSProperty;\n},{}],4:[function(_dereq_,module,exports){\n/**\n * Copyright 2013-present, Facebook, Inc.\n * All rights reserved.\n *\n * This source code is licensed under the BSD-style license found in the\n * LICENSE file in the root directory of this source tree. An additional grant\n * of patent rights can be found in the PATENTS file in the same directory.\n *\n * @providesModule CSSPropertyOperations\n */\n\n\'use strict\';\n\nvar CSSProperty = _dereq_(3);\nvar ExecutionEnvironment = _dereq_(147);\nvar ReactInstrumentation = _dereq_(74);\n\nvar camelizeStyleName = _dereq_(149);\nvar dangerousStyleValue = _dereq_(120);\nvar hyphenateStyleName = _dereq_(160);\nvar memoizeStringOnly = _dereq_(167);\nvar warning = _dereq_(171);\n\nvar processStyleName = memoizeStringOnly(function (styleName) {\n  return hyphenateStyleName(styleName);\n});\n\nvar hasShorthandPropertyBug = false;\nvar styleFloatAccessor = \'cssFloat\';\nif (ExecutionEnvironment.canUseDOM) {\n  var tempStyle = document.createElement(\'div\').style;\n  try {\n    // IE8 throws "Invalid argument." if resetting shorthand style properties.\n    tempStyle.font = \'\';\n  } catch (e) {\n    hasShorthandPropertyBug = true;\n  }\n  // IE8 only supports accessing cssFloat (standard) as styleFloat\n  if (document.documentElement.style.cssFloat === undefined) {\n    styleFloatAccessor = \'styleFloat\';\n  }\n}\n\nif ("development" !== \'production\') {\n  // \'msTransform\' is correct, but the other prefixes should be capitalized\n  var badVendoredStyleNamePattern = /^(?:webkit|moz|o)[A-Z]/;\n\n  // style values shouldn\'t contain a semicolon\n  var badStyleValueWithSemicolonPattern = /;s*$/;\n\n  var warnedStyleNames = {};\n  var warnedStyleValues = {};\n  var warnedForNaNValue = false;\n\n  var warnHyphenatedStyleName = function (name, owner) {\n    if (warnedStyleNames.hasOwnProperty(name) && warnedStyleNames[name]) {\n      return;\n    }\n\n    warnedStyleNames[name] = true;\n    "development" !== \'production\' ? warning(false, \'Unsupported style property %s. Did you mean %s?%s\', name, camelizeStyleName(name), checkRenderMessage(owner)) : void 0;\n  };\n\n  var warnBadVendoredStyleName = function (name, owner) {\n    if (warnedStyleNames.hasOwnProperty(name) && warnedStyleNames[name]) {\n      return;\n    }\n\n    warnedStyleNames[name] = true;\n    "development" !== \'production\' ? warning(false, \'Unsupported vendor-prefixed style property %s. Did you mean %s?%s\', name, name.charAt(0).toUpperCase() + name.slice(1), checkRenderMessage(owner)) : void 0;\n  };\n\n  var warnStyleValueWithSemicolon = function (name, value, owner) {\n    if (warnedStyleValues.hasOwnProperty(value) && warnedStyleValues[value]) {\n      return;\n    }\n\n    warnedStyleValues[value] = true;\n    "development" !== \'production\' ? warning(false, \'Style property values shouldn contain a semicolon.%s \' + \'Try "%s: %s" instead.\', checkRenderMessage(owner), name, value.replace(badStyleValueWithSemicolonPattern, \'\')) : void 0;\n  };\n\n  var warnStyleValueIsNaN = function (name, value, owner) {\n    if (warnedForNaNValue) {\n      return;\n    }\n\n    warnedForNaNValue = true;\n    "development" !== \'production\' ? warning(false, \'NaN is an invalid value for the %s css style property.%s\', name, checkRenderMessage(owner)) : void 0;\n  };\n\n  var checkRenderMessage = function (owner) {\n    if (owner) {\n      var name = owner.getName();\n      if (name) {\n        return \' Check the render method of \' + name + \'.\';\n      }\n    }\n    return \'\';\n  };\n\n  /**\n   * @param {string} name\n   * @param {*} value\n   * @param {ReactDOMComponent} component\n   */\n  var warnValidStyle = function (name, value, component) {\n    var owner;\n    if (component) {\n      owner = component._currentElement._owner;\n    }\n    if (name.indexOf(\'-\') > -1) {\n      warnHyphenatedStyleName(name, owner);\n    } else if (badVendoredStyleNamePattern.test(name)) {\n      warnBadVendoredStyleName(name, owner);\n    } else if (badStyleValueWithSemicolonPattern.test(value)) {\n      warnStyleValueWithSemicolon(name, value, owner);\n    }\n\n    if (typeof value === \'number\' && isNaN(value)) {\n      warnStyleValueIsNaN(name, value, owner);\n    }\n  };\n}\n\n/**\n * Operations for dealing with CSS properties.\n */\nvar CSSPropertyOperations = {\n\n  /**\n   * Serializes a mapping of style properties for use as inline styles:\n   *\n   *   > createMarkupForStyles({width: \'200px\', height: 0})\n   *   "width:200px;height:0;"\n   *\n   * Undefined values are ignored so that declarative programming is easier.\n   * The result should be HTML-escaped before insertion into the DOM.\n   *\n   * @param {object} styles\n   * @param {ReactDOMComponent} component\n   * @return {?string}\n   */\n  createMarkupForStyles: function (styles, component) {\n    var serialized = \'\';\n    for (var styleName in styles) {\n      if (!styles.hasOwnProperty(styleName)) {\n        continue;\n      }\n      var styleValue = styles[styleName];\n      if ("development" !== \'production\') {\n        warnValidStyle(styleName, styleValue, component);\n      }\n      if (styleValue != null) {\n        serialized += processStyleName(styleName) + \':\';\n        serialized += dangerousStyleValue(styleName, styleValue, component) + \';\';\n      }\n    }\n    return serialized || null;\n  },\n\n  /**\n   * Sets the value for multiple styles on a node.  If a value is specified as\n   * \'\' (empty string), the corresponding style property will be unset.\n   *\n   * @param {DOMElement} node\n   * @param {object} styles\n   * @param {ReactDOMComponent} component\n   */\n  setValueForStyles: function (node, styles, component) {\n    if ("development" !== \'production\') {\n      ReactInstrumentation.debugTool.onHostOperation(component._debugID, \'update styles\', styles);\n    }\n\n    var style = node.style;\n    for (var styleName in styles) {\n      if (!styles.hasOwnProperty(styleName)) {\n        continue;\n      }\n      if ("development" !== \'production\') {\n        warnValidStyle(styleName, styles[styleName], component);\n      }\n      var styleValue = dangerousStyleValue(styleName, styles[styleName], component);\n      if (styleName === \'float\' || styleName === \'cssFloat\') {\n        styleName = styleFloatAccessor;\n      }\n      if (styleValue) {\n        style[styleName] = styleValue;\n      } else {\n        var expansion = hasShorthandPropertyBug && CSSProperty.shorthandPropertyExpansions[styleName];\n        if (expansion) {\n          // Shorthand property that IE8 won\'t like unsetting, so unset each\n          // component to placate it\n          for (var individualStyleName in expansion) {\n            style[individualStyleName] = \'\';\n          }\n        } else {\n          style[styleName] = \'\';\n        }\n      }\n    }\n  }\n\n};\n\nmodule.exports = CSSPropertyOperations;\n},{"120":120,"147":147,"149":149,"160":160,"167":167,"171":171,"3":3,"74":74}],5:[function(_dereq_,module,exports){\n/**\n * Copyright 2013-present, Facebook, Inc.\n * All rights reserved.\n *\n * This source code is licensed under the BSD-style license found in the\n * LICENSE file in the root directory of this source tree. An additional grant\n * of patent rights can be found in the PATENTS file in the same directory.\n *\n * @providesModule CallbackQueue\n */\n\n\'use strict\';\n\nvar _prodInvariant = _dereq_(139),\n    _assign = _dereq_(172);\n\nvar PooledClass = _dereq_(25);\n\nvar invariant = _dereq_(161);\n\n/**\n * A specialized pseudo-event module to help keep track of components waiting to\n * be notified when their DOM representations are available for use.\n *\n * This implements PooledClass, so you should never need to instantiate this.\n * Instead, use CallbackQueue.getPooled().\n *\n * @class ReactMountReady\n * @implements PooledClass\n * @internal\n */\nfunction CallbackQueue() {\n  this._callbacks = null;\n  this._contexts = null;\n}\n\n_assign(CallbackQueue.prototype, {\n\n  /**\n   * Enqueues a callback to be invoked when notifyAll is invoked.\n   *\n   * @param {function} callback Invoked when notifyAll is invoked.\n   * @param {?object} context Context to call callback with.\n   * @internal\n   */\n  enqueue: function (callback, context) {\n    this._callbacks = this._callbacks || [];\n    this._contexts = this._contexts || [];\n    this._callbacks.push(callback);\n    this._contexts.push(context);\n  },\n\n  /**\n   * Invokes all enqueued callbacks and clears the queue. This is invoked after\n   * the DOM representation of a component has been created or updated.\n   *\n   * @internal\n   */\n  notifyAll: function () {\n    var callbacks = this._callbacks;\n    var contexts = this._contexts;\n    if (callbacks) {\n      !(callbacks.length === contexts.length) ? "development" !== \'production\' ? invariant(false, \'Mismatched list of contexts in callback queue\') : _prodInvariant(\'24\') : void 0;\n      this._callbacks = null;\n      this._contexts = null;\n      for (var i = 0; i < callbacks.length; i++) {\n        callbacks[i].call(contexts[i]);\n      }\n      callbacks.length = 0;\n      contexts.length = 0;\n    }\n  },\n\n  checkpoint: function () {\n    return this._callbacks ? this._callbacks.length : 0;\n  },\n\n  rollback: function (len) {\n    if (this._callbacks) {\n      this._callbacks.length = len;\n      this._contexts.length = len;\n    }\n  },\n\n  /**\n   * Resets the internal queue.\n   *\n   * @internal\n   */\n  reset: function () {\n    this._callbacks = null;\n    this._contexts = null;\n  },\n\n  /**\n   * PooledClass looks for this.\n   */\n  destructor: function () {\n    this.reset();\n  }\n\n});\n\nPooledClass.addPoolingTo(CallbackQueue);\n\nmodule.exports = CallbackQueue;\n},{"139":139,"161":161,"172":172,"25":25}],6:[function(_dereq_,module,exports){\n/**\n * Copyright 2013-present, Facebook, Inc.\n * All rights reserved.\n *\n * This source code is licensed under the BSD-style license found in the\n * LICENSE file in the root directory of this source tree. An additional grant\n * of patent rights can be found in the PATENTS file in the same directory.\n *\n * @providesModule ChangeEventPlugin\n */\n\n\'use strict\';\n\nvar EventConstants = _dereq_(16);\nvar EventPluginHub = _dereq_(17);\nvar EventPropagators = _dereq_(20);\nvar ExecutionEnvironment = _dereq_(147);\nvar ReactDOMComponentTree = _dereq_(41);\nvar ReactUpdates = _dereq_(95);\nvar SyntheticEvent = _dereq_(104);\n\nvar getEventTarget = _dereq_(128);\nvar isEventSupported = _dereq_(135);\nvar isTextInputElement = _dereq_(136);\nvar keyOf = _dereq_(165);\n\nvar topLevelTypes = EventConstants.topLevelTypes;\n\nvar eventTypes = {\n  change: {\n    phasedRegistrationNames: {\n      bubbled: keyOf({ onChange: null }),\n      captured: keyOf({ onChangeCapture: null })\n    },\n    dependencies: [topLevelTypes.topBlur, topLevelTypes.topChange, topLevelTypes.topClick, topLevelTypes.topFocus, topLevelTypes.topInput, topLevelTypes.topKeyDown, topLevelTypes.topKeyUp, topLevelTypes.topSelectionChange]\n  }\n};\n\n/**\n * For IE shims\n */\nvar activeElement = null;\nvar activeElementInst = null;\nvar activeElementValue = null;\nvar activeElementValueProp = null;\n\n/**\n * SECTION: handle change event\n */\nfunction shouldUseChangeEvent(elem) {\n  var nodeName = elem.nodeName && elem.nodeName.toLowerCase();\n  return nodeName === \'select\' || nodeName === \'input\' && elem.type === \'file\';\n}\n\nvar doesChangeEventBubble = false;\nif (ExecutionEnvironment.canUseDOM) {\n  // See handleChange comment below\n  doesChangeEventBubble = isEventSupported(\'change\') && (!(\'documentMode\' in document) || document.documentMode > 8);\n}\n\nfunction manualDispatchChangeEvent(nativeEvent) {\n  var event = SyntheticEvent.getPooled(eventTypes.change, activeElementInst, nativeEvent, getEventTarget(nativeEvent));\n  EventPropagators.accumulateTwoPhaseDispatches(event);\n\n  // If change and propertychange bubbled, we\'d just bind to it like all the\n  // other events and have it go through ReactBrowserEventEmitter. Since it\n  // doesn\'t, we manually listen for the events and so we have to enqueue and\n  // process the abstract event manually.\n  //\n  // Batching is necessary here in order to ensure that all event handlers run\n  // before the next rerender (including event handlers attached to ancestor\n  // elements instead of directly on the input). Without this, controlled\n  // components don\'t work properly in conjunction with event bubbling because\n  // the component is rerendered and the value reverted before all the event\n  // handlers can run. See https://github.com/facebook/react/issues/708.\n  ReactUpdates.batchedUpdates(runEventInBatch, event);\n}\n\nfunction runEventInBatch(event) {\n  EventPluginHub.enqueueEvents(event);\n  EventPluginHub.processEventQueue(false);\n}\n\nfunction startWatchingForChangeEventIE8(target, targetInst) {\n  activeElement = target;\n  activeElementInst = targetInst;\n  activeElement.attachEvent(\'onchange\', manualDispatchChangeEvent);\n}\n\nfunction stopWatchingForChangeEventIE8() {\n  if (!activeElement) {\n    return;\n  }\n  activeElement.detachEvent(\'onchange\', manualDispatchChangeEvent);\n  activeElement = null;\n  activeElementInst = null;\n}\n\nfunction getTargetInstForChangeEvent(topLevelType, targetInst) {\n  if (topLevelType === topLevelTypes.topChange) {\n    return targetInst;\n  }\n}\nfunction handleEventsForChangeEventIE8(topLevelType, target, targetInst) {\n  if (topLevelType === topLevelTypes.topFocus) {\n    // stopWatching() should be a noop here but we call it just in case we\n    // missed a blur event somehow.\n    stopWatchingForChangeEventIE8();\n    startWatchingForChangeEventIE8(target, targetInst);\n  } else if (topLevelType === topLevelTypes.topBlur) {\n    stopWatchingForChangeEventIE8();\n  }\n}\n\n/**\n * SECTION: handle input event\n */\nvar isInputEventSupported = false;\nif (ExecutionEnvironment.canUseDOM) {\n  // IE9 claims to support the input event but fails to trigger it when\n  // deleting text, so we ignore its input events.\n  // IE10+ fire input events to often, such when a placeholder\n  // changes or when an input with a placeholder is focused.\n  isInputEventSupported = isEventSupported(\'input\') && (!(\'documentMode\' in document) || document.documentMode > 11);\n}\n\n/**\n * (For IE <=11) Replacement getter/setter for the value property that gets\n * set on the active element.\n */\nvar newValueProp = {\n  get: function () {\n    return activeElementValueProp.get.call(this);\n  },\n  set: function (val) {\n    // Cast to a string so we can do equality checks.\n    activeElementValue = \'\' + val;\n    activeElementValueProp.set.call(this, val);\n  }\n};';

var App = function (_React$Component) {
  _inherits(App, _React$Component);

  function App() {
    _classCallCheck(this, App);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(App).call(this));

    _this.state = {
      begin: false,
      cursor: '|',
      code: '',
      location: 0
    };
    _this.handleInput = _this.handleInput.bind(_this);
    _this.blink = _this.blink.bind(_this);
    return _this;
  }

  _createClass(App, [{
    key: 'handleInput',
    value: function handleInput(event) {

      if (!this.state.begin) {
        this.setState({ begin: true });
      }

      if (this.state.location < codeString.length) {

        var len = Math.round(25 - Math.random() * 20);
        var currentLocation = this.state.location;
        var newStr;

        if (currentLocation < 1500) {
          newStr = codeString.substr(0, currentLocation + len);
          this.setState({
            code: newStr,
            location: currentLocation + len
          });
        } else if (currentLocation >= 1500) {
          newStr = codeString.substr(currentLocation - 1500, currentLocation + len);
          this.setState({
            code: newStr,
            location: currentLocation + len
          });
        }
      }
    }
  }, {
    key: 'blink',
    value: function blink() {
      var cursorBlink = setInterval(function () {
        if (this.state.begin === true) {
          stopBlink();
        }
        if (this.state.cursor === '|') {
          this.setState({
            cursor: ''
          });
        } else {
          this.setState({
            cursor: '|'
          });
        }
      }.bind(this), 450);

      function stopBlink() {
        clearInterval(cursorBlink);
      }
    }
  }, {
    key: 'componentDidMount',
    value: function componentDidMount() {
      window.addEventListener('keydown', this.handleInput);
      this.blink();
    }
  }, {
    key: 'componentDidUpdate',
    value: function componentDidUpdate() {
      Prism.highlightAll();
      document.getElementById("codeContainer").scrollTop = document.getElementById("codeContainer").scrollHeight;
    }
  }, {
    key: 'render',
    value: function render() {
      return _react2.default.createElement(
        'div',
        null,
        _react2.default.createElement(CodeComponent, { begin: this.state.begin, cursor: this.state.cursor, code: this.state.code })
      );
    }
  }]);

  return App;
}(_react2.default.Component);

;

var CodeComponent = function (_React$Component2) {
  _inherits(CodeComponent, _React$Component2);

  function CodeComponent() {
    _classCallCheck(this, CodeComponent);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(CodeComponent).apply(this, arguments));
  }

  _createClass(CodeComponent, [{
    key: 'render',
    value: function render() {
      var codeString;
      if (this.props.begin === false) {
        codeString = 'Start typing...' + this.props.cursor;
      } else if (this.props.begin === true) {
        codeString = this.props.code;
      }
      return _react2.default.createElement(
        'div',
        null,
        _react2.default.createElement(
          'pre',
          { className: 'language-js', id: 'codeContainer' },
          _react2.default.createElement(
            'code',
            { className: 'language-js' },
            codeString
          )
        )
      );
    }
  }]);

  return CodeComponent;
}(_react2.default.Component);

;

exports.default = App;