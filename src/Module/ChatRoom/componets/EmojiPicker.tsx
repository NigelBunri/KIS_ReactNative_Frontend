import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  SectionList,
  ActivityIndicator,
  TextInput,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type EmojiPickerProps = {
  palette: any;
  onSelectEmoji: (emoji: string) => void;
  recentEmojis?: string[];
};

type EmojiCategory = {
  id: string;
  label: string;
  emojis: string[];
};

type EmojiRow = {
  key: string;
  emojis: string[];
};

const RECENT_EMOJIS_KEY = '@kis_recent_emojis';
const MAX_RECENT_EMOJIS = 40;
const EMOJIS_PER_ROW = 8;

/**
 * ============================
 * Emoji constants by category
 * ============================
 * (same as your current file – truncated comments only)
 */

// Smileys & People (add until ≥ 448)
export const EMOJI_SMILEYS_PEOPLE: string[] = [
  // faces
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
  '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
  '😘', '😗', '☺️', '😚', '😙', '🥲', '😋', '😛',
  '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🫢', '🫣',
  '🤫', '🤥', '😶', '😶‍🌫️', '😐', '😑', '😬', '🙄',
  '😯', '😦', '😧', '😮', '😲', '😳', '🥺', '🥹',
  '😦', '😨', '😰', '😥', '😢', '😭', '😱', '😖',
  '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡',
  '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡',
  '👹', '👺', '👻', '👽', '👾', '🤖',

  // hearts / love / affection
  '💋', '💘', '💝', '💖', '💗', '💓', '💞', '💕',
  '💌', '💟', '❤️', '🩷', '🧡', '💛', '💚', '💙',
  '🩵', '💜', '🤎', '🖤', '🩶', '🤍', '💔',

  // gestures / hands
  '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏',
  '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉',
  '👆', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛',
  '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️',
  '💅', '🤳', '🫵', '🫶',

  // people / body
  '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅',
  '👄', '👶', '🧒', '👦', '👧', '🧑', '👨', '👩',
  '🧓', '👴', '👵', '👨‍🦰', '👨‍🦱', '👨‍🦳', '👨‍🦲',
  '👩‍🦰', '👩‍🦱', '👩‍🦳', '👩‍🦲',
  '👨‍🧔', '👩‍🧔',
  '👮', '👷', '💂', '🕵️', '👩‍⚕️', '👨‍⚕️',
  '👩‍🎓', '👨‍🎓', '👩‍🏫', '👨‍🏫',
  '👩‍⚖️', '👨‍⚖️', '👩‍🌾', '👨‍🌾',
  '👩‍🍳', '👨‍🍳', '👩‍🔧', '👨‍🔧',
  '👩‍🏭', '👨‍🏭', '👩‍💼', '👨‍💼',
  '👩‍🔬', '👨‍🔬', '👩‍💻', '👨‍💻',
  '👩‍🎤', '👨‍🎤', '👩‍🎨', '👨‍🎨',
  '👩‍✈️', '👨‍✈️', '👩‍🚀', '👨‍🚀',
  '👩‍🚒', '👨‍🚒',

  '👯', '💃', '🕺', '🧍', '🧎', '🧑‍🦯', '🧑‍🦼', '🧑‍🦽',
  '🏃', '🚶', '🧗', '🏇', '⛷️', '🏂', '🏌️', '🏄',

  // families & relationships
  '👫', '👬', '👭', '💏', '💑',
  '👪', '👨‍👩‍👦', '👨‍👩‍👧', '👨‍👩‍👧‍👦', '👨‍👨‍👦', '👩‍👩‍👧',

  // other people-ish
  '🧙', '🧚', '🧛', '🧜', '🧝', '🧞', '🧟', '🧌',

  // TODO: extend to exceed 448 items.
];

// Animals & Nature (add until ≥ 216)
export const EMOJI_ANIMALS_NATURE: string[] = [
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼',
  '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸',
  '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦',
  '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺',
  '🐗', '🐴', '🦄', '🐝', '🪲', '🐛', '🦋', '🐌',
  '🐞', '🐜', '🦂', '🕷️', '🕸️', '🐢', '🐍', '🦎',
  '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡',
  '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅',
  '🐆', '🦓', '🦍', '🦧', '🦣', '🐘', '🦛', '🦏',
  '🐪', '🐫', '🦒', '🐃', '🐂', '🐄', '🐎', '🐖',
  '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐕‍🦺', '🐩',
  '🐈', '🐈‍⬛', '🐓', '🦃', '🦚', '🦜', '🦢', '🕊️',
  '🐇', '🦝', '🦨', '🦡', '🦫', '🦦', '🦥', '🐿️',

  '🌵', '🎄', '🌲', '🌳', '🌴', '🌱', '🌿', '☘️',
  '🍀', '🎍', '🪴', '🌷', '🌹', '🥀', '🌺', '🌸',
  '🌼', '🌻', '🌞', '🌝', '🌛', '🌜', '🌚', '🌕',
  '🌖', '🌗', '🌘', '🌑', '🌒', '🌓', '🌔', '🌙',
  '⭐', '🌟', '🌠', '🌌', '☀️', '⛅', '🌤️', '🌥️',
  '🌦️', '🌧️', '⛈️', '🌩️', '🌨️', '❄️', '☃️', '⛄',
  '🌬️', '💨', '🌪️', '🌫️', '🌈', '💧', '💦', '☔',
  '🔥', '💥',
  // TODO: extend to ≥ 216.
];

// Food & Drink (add until ≥ 136)
export const EMOJI_FOOD_DRINK: string[] = [
  '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇',
  '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥',
  '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️',
  '🫑', '🌽', '🥕', '🧄', '🧅', '🥔', '🍠', '🫘',
  '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳',
  '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🫘', '🌭',
  '🍔', '🍟', '🍕', '🫓', '🥪', '🌮', '🌯', '🫔',
  '🥙', '🧆', '🥚', '🍝', '🍜', '🍲', '🍛', '🍣',
  '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥',
  '🥠', '🥡', '🦞', '🦐', '🦑',
  '🍦', '🍧', '🍨', '🍩', '🍪', '🎂', '🍰', '🧁',
  '🥧', '🍫', '🍬', '🍭', '🍮', '🍯',
  '🍼', '🥛', '☕', '🍵', '🧃', '🥤', '🧋', '🍺',
  '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾',
  '🧊',
  // TODO: extend to ≥ 136.
];

// Activity (add until ≥ 128)
export const EMOJI_ACTIVITY: string[] = [
  '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉',
  '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍',
  '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣',
  '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸️',
  '🥌', '🛶', '🚣', '🏊', '🤽', '🤾', '🏄', '🏇',
  '🚴', '🚵', '🤸', '⛹️', '🤺', '🤼', '🤹',
  '🎖️', '🏆', '🏅', '🥇', '🥈', '🥉',
  '🎭', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁',
  '🎷', '🎺', '🎸', '🪕', '🪗',
  '🎮', '🕹️', '🎲', '♟️', '🧩',
  '🎯', '🎳', '🧗', '🏕️', '🏖️', '🎡', '🎢', '🎠',
  '🎪', '🎟️', '🎫',
  // TODO: extend to ≥ 128.
];

// Travel & Places (add until ≥ 128)
export const EMOJI_TRAVEL_PLACES: string[] = [
  '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑',
  '🚒', '🚐', '🚚', '🚛', '🚜', '🛴', '🚲', '🛵',
  '🏍️', '🛺', '🚨', '🚔', '🚍', '🚘', '🚖',
  '🚡', '🚠', '🚟', '🚃', '🚋', '🚞', '🚝', '🚄',
  '🚅', '🚈', '🚂', '🚆', '🚇', '🚊', '🚉',
  '✈️', '🛫', '🛬', '🛩️', '🛸', '🚁', '⛵', '🚤',
  '🛶', '🚀', '🛳️', '⛴️', '🚢',

  '🏠', '🏡', '🏘️', '🏚️', '🏗️', '🏭', '🏢', '🏬',
  '🏣', '🏤', '🏥', '🏦', '🏨', '🏩', '🏪', '🏫',
  '🏛️', '⛪', '🕌', '🕍', '🕋', '⛩️', '🛕',
  '🏰', '🏯', '🏟️', '🎡', '🎢', '🎠',
  '⛲', '⛺', '🌁', '🌃', '🏙️', '🌄', '🌅', '🌆',
  '🌇', '🌉', '🌌',

  '🗺️', '🗾', '🧭', '📍', '📌', '🧱',
  // TODO: extend to ≥ 128.
];

// Objects (add until ≥ 216)
export const EMOJI_OBJECTS: string[] = [
  '⌚', '📱', '📲', '💻', '🖥️', '🖨️', '⌨️', '🖱️',
  '🖲️', '💽', '💾', '💿', '📀', '📼',
  '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️',
  '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭',
  '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳',
  '📡', '🔋', '🔌', '💡', '🔦', '🕯️',
  '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '💰',
  '💳', '🧾', '💹',

  '✉️', '📧', '📨', '📩', '📤', '📥', '📦', '📫',
  '📪', '📬', '📭', '📮',
  '📁', '📂', '🗂️', '📅', '📆', '🗒️', '🗓️', '📇',
  '📈', '📉', '📊', '📋', '📌', '📍', '📎', '🖇️',
  '📏', '📐', '✂️', '🖊️', '🖋️', '✒️', '🖌️', '🖍️',
  '📝', '📙', '📘', '📗', '📕', '📚', '📖',

  '🧰', '🪛', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🪓',
  '🔩', '⚙️', '🗜️', '⚖️', '🔗', '⛓️',
  '🧱', '🪚', '🪜', '🧲', '🪤',

  '🔑', '🗝️', '🚪', '🪑', '🛏️', '🛋️', '🚿', '🛁',
  '🚽', '🪠', '🪥', '🧴', '🧼', '🧻', '🧽', '🪣',
  '🧺', '🧹', '🧯', '🧸', '🪆',
  '🧷', '🧵', '🪡', '🧶',
  '🛒', '🎁', '🎈', '🎀', '🎊',

  '👓', '🕶️', '🥽', '🥼', '🦺', '👔', '👕', '👖',
  '🧣', '🧤', '🧥', '🧦', '👗', '👘', '🥻', '🩱',
  '🩲', '🩳', '👙', '👚', '👛', '👜', '👝', '🛍️',
  '🎒', '👞', '👟', '🥾', '🥿', '👠', '👡', '🩴',
  '👢', '👑', '👒', '🎩', '🎓', '🧢', '🪖', '⛑️',

  '🩺', '💉', '💊', '🩹', '🩼', '🩻',
  '🔬', '🔭', '📡',
  // TODO: extend to ≥ 216.
];

// Symbols (add until ≥ 300)
export const EMOJI_SYMBOLS: string[] = [
  '❤️', '💔', '❣️', '💕', '💞', '💓', '💗', '💖',
  '💘', '💝', '💟',
  '💯', '♻️', '⚜️', '🔱', '📛', '🔰', '⭕', '✅',
  '☑️', '✔️', '❌', '❎', '➕', '➖', '➗', '➰',
  '➿', '✖️', '✳️', '✴️', '‼️', '⁉️', '❓', '❔',
  '❕', '❗', '🔟', '🔢',
  '#️⃣', '*️⃣', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣',
  '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣',

  '⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️',
  '↕️', '↔️', '↩️', '↪️', '⤴️', '⤵️',
  '🔃', '🔄', '🔁', '🔂', '🔀', '🔼', '🔽',

  '⚪', '⚫', '🔵', '🔴', '🟠', '🟡', '🟢', '🟣',
  '🟤', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '🟫',
  '⬛', '⬜', '◼️', '◻️', '◾', '◽', '▪️', '▫️',

  '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏',
  '♐', '♑', '♒', '♓',
  '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎',
  '☯️', '☦️',
  '♠️', '♥️', '♦️', '♣️',
  '🎴', '🀄',
  '🔞', '🚫', '⛔', '📵', '🚭', '❗', '❕',
  '⚠️', '☢️', '☣️',

  '⏱️', '⏲️', '⏰', '🕛', '🕧', '🕐', '🕜', '🕑',
  '🕝', '🕒', '🕞', '🕓', '🕟', '🕔', '🕠', '🕕',
  '🕡', '🕖', '🕢', '🕗', '🕣', '🕘', '🕤', '🕙',
  '🕥', '🕚', '🕦',
  // TODO: extend to ≥ 300.
];

// Flags (add until ≥ 300)
export const EMOJI_FLAGS: string[] = [
  '🏁', '🚩', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🏴‍☠️',

  '🇦🇫', '🇦🇱', '🇩🇿', '🇦🇸', '🇦🇩', '🇦🇴', '🇦🇮', '🇦🇶',
  '🇦🇬', '🇦🇷', '🇦🇲', '🇦🇼', '🇦🇺', '🇦🇹', '🇦🇿',
  '🇧🇸', '🇧🇭', '🇧🇩', '🇧🇧', '🇧🇾', '🇧🇪', '🇧🇿', '🇧🇯',
  '🇧🇲', '🇧🇹', '🇧🇴', '🇧🇦', '🇧🇼', '🇧🇷', '🇧🇳', '🇧🇬',
  '🇧🇫', '🇧🇮', '🇨🇻', '🇰🇭', '🇨🇲', '🇨🇦', '🇨🇫', '🇹🇩',
  '🇨🇱', '🇨🇳', '🇨🇴', '🇰🇲', '🇨🇬', '🇨🇩', '🇨🇷', '🇭🇷',
  '🇨🇺', '🇨🇾', '🇨🇿',
  '🇩🇰', '🇩🇯', '🇩🇲', '🇩🇴',
  '🇪🇨', '🇪🇬', '🇸🇻', '🇬🇶', '🇪🇷', '🇪🇪', '🇪🇹',
  '🇫🇯', '🇫🇮', '🇫🇷',
  '🇬🇦', '🇬🇲', '🇬🇪', '🇩🇪', '🇬🇭', '🇬🇷', '🇬🇩', '🇬🇺',
  '🇬🇹', '🇬🇳', '🇬🇼', '🇬🇾',
  '🇭🇹', '🇭🇳', '🇭🇺',
  '🇮🇸', '🇮🇳', '🇮🇩', '🇮🇷', '🇮🇶', '🇮🇪', '🇮🇱', '🇮🇹',
  '🇯🇲', '🇯🇵', '🇯🇴',
  '🇰🇿', '🇰🇪', '🇰🇮', '🇰🇵', '🇰🇷', '🇰🇼', '🇰🇬',
  '🇱🇦', '🇱🇻', '🇱🇧', '🇱🇸', '🇱🇷', '🇱🇾', '🇱🇹', '🇱🇺',
  '🇲🇰', '🇲🇬', '🇲🇼', '🇲🇾', '🇲🇻', '🇲🇱', '🇲🇹', '🇲🇷',
  '🇲🇺', '🇲🇽', '🇫🇲', '🇲🇩', '🇲🇳', '🇲🇪', '🇲🇦', '🇲🇿',
  '🇲🇲',
  '🇳🇦', '🇳🇵', '🇳🇱', '🇳🇿', '🇳🇮', '🇳🇪', '🇳🇬', '🇳🇴',
  '🇴🇲',
  '🇵🇰', '🇵🇼', '🇵🇦', '🇵🇬', '🇵🇾', '🇵🇪', '🇵🇭', '🇵🇱',
  '🇵🇹', '🇵🇷',
  '🇶🇦',
  '🇷🇴', '🇷🇺', '🇷🇼',
  '🇼🇸', '🇸🇦', '🇸🇳', '🇷🇸', '🇸🇨', '🇸🇱', '🇸🇬', '🇸🇰',
  '🇸🇮', '🇸🇧', '🇸🇴', '🇿🇦', '🇸🇸', '🇪🇸', '🇱🇰', '🇸🇩',
  '🇸🇷', '🇸🇿', '🇸🇪', '🇨🇭', '🇸🇾',
  '🇹🇼', '🇹🇯', '🇹🇿', '🇹🇭', '🇹🇱', '🇹🇬', '🇹🇴', '🇹🇹',
  '🇹🇳', '🇹🇷', '🇹🇲', '🇹🇻',
  '🇺🇬', '🇺🇦', '🇦🇪', '🇬🇧', '🇺🇸', '🇺🇾', '🇺🇿',
  '🇻🇺', '🇻🇪', '🇻🇳',
  '🇾🇪', '🇿🇲', '🇿🇼',
  // TODO: extend to ≥ 300.
];


/** Lookup map for emoji keyword search — covers the most common reaction emojis. */
const EMOJI_NAME_LOOKUP: Record<string, string> = {
  '❤️': 'heart love red',
  '🧡': 'heart orange love',
  '💛': 'heart yellow love',
  '💚': 'heart green love',
  '💙': 'heart blue love',
  '💜': 'heart purple love',
  '🖤': 'heart black love',
  '🤍': 'heart white love',
  '💔': 'broken heart sad',
  '👍': 'thumbs up like good',
  '👎': 'thumbs down dislike',
  '😀': 'grin smile happy',
  '😃': 'smile happy grin',
  '😄': 'laugh smile happy',
  '😁': 'grin beam smile',
  '😆': 'laugh funny lol',
  '😅': 'sweat laugh nervous',
  '🤣': 'rolling laugh cry funny',
  '😂': 'laugh cry funny lol tears',
  '🙂': 'smile slight happy',
  '🙃': 'upside down silly',
  '😉': 'wink',
  '😊': 'smile blush happy',
  '😇': 'angel innocent halo',
  '🥰': 'love hearts smiling',
  '😍': 'heart eyes love amazing',
  '🤩': 'star eyes amazing wow',
  '😘': 'kiss blowing love',
  '😎': 'cool sunglasses',
  '🤔': 'thinking hmm',
  '🤗': 'hug happy',
  '😮': 'wow surprise open mouth',
  '😲': 'astonished shock surprised',
  '😳': 'flushed embarrassed',
  '🥺': 'pleading puppy eyes',
  '😢': 'sad cry tear',
  '😭': 'sob cry loud sad',
  '😤': 'steam angry frustrated',
  '😡': 'angry mad rage red',
  '🤬': 'cursing angry swearing mad',
  '😈': 'devil evil smiling',
  '👿': 'devil angry imp',
  '💀': 'skull dead',
  '💩': 'poop shit',
  '🤡': 'clown joker',
  '👋': 'wave hand hello hi',
  '🤚': 'raised hand stop',
  '✋': 'hand raised stop',
  '👌': 'ok cool perfect',
  '✌️': 'peace victory two',
  '🤞': 'fingers crossed luck',
  '🤟': 'love you hand',
  '🤘': 'rock metal horns',
  '👈': 'point left',
  '👉': 'point right',
  '👆': 'point up',
  '👇': 'point down',
  '☝️': 'one point up',
  '👏': 'clap applause',
  '🙌': 'raise hands celebrate',
  '🤝': 'handshake agreement',
  '🙏': 'pray thanks please folded hands',
  '✍️': 'write pen',
  '💪': 'muscle strong flex',
  '🔥': 'fire hot flame',
  '✅': 'check done tick green',
  '❌': 'cross wrong no',
  '⭕': 'circle red',
  '❓': 'question mark',
  '❗': 'exclamation mark',
  '💯': 'hundred perfect score',
  '🎉': 'party celebrate confetti',
  '🎊': 'party celebrate',
  '🎁': 'gift present',
  '🎈': 'balloon party',
  '🏆': 'trophy winner champion',
  '🥇': 'gold medal first winner',
  '⭐': 'star yellow',
  '🌟': 'glowing star shine',
  '💫': 'dizzy star sparkle',
  '✨': 'sparkles shine',
  '🚀': 'rocket launch',
  '💡': 'idea light bulb',
  '🔑': 'key unlock',
  '💰': 'money bag cash',
  '💵': 'dollar bill money',
  '📸': 'camera photo',
  '📱': 'phone mobile',
  '💻': 'laptop computer',
  '👀': 'eyes look',
  '👁️': 'eye look',
  '👂': 'ear listen',
  '👃': 'nose smell',
  '🫀': 'heart organ',
  '🧠': 'brain think smart',
  '🦷': 'tooth dental',
  '🍎': 'apple red fruit',
  '🍕': 'pizza',
  '🍔': 'burger hamburger food',
  '🍟': 'fries chips',
  '☕': 'coffee hot drink',
  '🍵': 'tea hot drink',
  '🍺': 'beer drink',
  '🎵': 'music note',
  '🎶': 'music notes',
  '🎸': 'guitar music',
  '🏃': 'run running',
  '🚗': 'car drive',
  '✈️': 'plane fly travel',
  '🌍': 'earth world globe',
  '🌈': 'rainbow color',
  '🌊': 'wave ocean water',
  '⛄': 'snowman winter',
  '🌙': 'moon night crescent',
  '☀️': 'sun sunny bright',
  '⚡': 'lightning bolt electric fast',
  '🌺': 'flower hibiscus',
  '🌸': 'cherry blossom flower',
  '🌹': 'rose flower love',
  '🌻': 'sunflower yellow',
  '🌷': 'tulip flower pink',
  '🍀': 'four leaf clover lucky',
  '🐶': 'dog puppy pet',
  '🐱': 'cat kitten pet',
  '🐭': 'mouse rat',
  '🐸': 'frog',
  '🐧': 'penguin',
  '🦊': 'fox animal',
  '🦁': 'lion king',
  '🐯': 'tiger',
  '🐻': 'bear',
  '🐼': 'panda',
  '🦋': 'butterfly',
  '🐝': 'bee honey',
  '🌏': 'earth asia globe',
};

/** Returns keyword string for an emoji, or empty string if unknown. */
function emojiNameFor(emoji: string): string {
  return EMOJI_NAME_LOOKUP[emoji] ?? '';
}

/**
 * Build categories array. Recents will be dynamically injected
 * at the top when we render if `recentEmojis` is provided.
 */
const buildCategories = (recentEmojis?: string[]): EmojiCategory[] => {
  const categories: EmojiCategory[] = [];

  if (recentEmojis && recentEmojis.length > 0) {
    categories.push({
      id: 'recents',
      label: 'Recents',
      emojis: recentEmojis,
    });
  }

  categories.push(
    { id: 'smileys-people', label: 'Smileys & People', emojis: EMOJI_SMILEYS_PEOPLE },
    { id: 'animals-nature', label: 'Animals & Nature', emojis: EMOJI_ANIMALS_NATURE },
    { id: 'food-drink', label: 'Food & Drink', emojis: EMOJI_FOOD_DRINK },
    { id: 'activity', label: 'Activity', emojis: EMOJI_ACTIVITY },
    { id: 'travel-places', label: 'Travel & Places', emojis: EMOJI_TRAVEL_PLACES },
    { id: 'objects', label: 'Objects', emojis: EMOJI_OBJECTS },
    { id: 'symbols', label: 'Symbols', emojis: EMOJI_SYMBOLS },
    { id: 'flags', label: 'Flags', emojis: EMOJI_FLAGS },
  );

  return categories;
};

// Utility to chunk emojis into rows
const chunkEmojisToRows = (emojis: string[], catId: string): EmojiRow[] => {
  const rows: EmojiRow[] = [];
  for (let i = 0; i < emojis.length; i += EMOJIS_PER_ROW) {
    const rowEmojis = emojis.slice(i, i + EMOJIS_PER_ROW);
    rows.push({
      key: `${catId}-row-${i / EMOJIS_PER_ROW}`,
      emojis: rowEmojis,
    });
  }
  return rows;
};

const KIS_RECENT_REACTIONS_KEY = 'KIS_RECENT_REACTIONS';
const MAX_RECENT_REACTIONS = 20;
const RECENT_REACTIONS_DISPLAY = 8;

export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  palette,
  onSelectEmoji,
  recentEmojis, // optional external override
}) => {
  const [internalRecents, setInternalRecents] = useState<string[]>([]);
  const [reactionRecents, setReactionRecents] = useState<string[]>([]);
  const [loadingRecents, setLoadingRecents] = useState<boolean>(!recentEmojis);
  // GAP 2: emoji search query
  const [emojiSearchQuery, setEmojiSearchQuery] = useState('');

  // Load recents from AsyncStorage on mount, if we're managing them internally
  useEffect(() => {
    const loadRecents = async () => {
      try {
        const [raw, rawReactions] = await Promise.all([
          recentEmojis ? Promise.resolve(null) : AsyncStorage.getItem(RECENT_EMOJIS_KEY),
          AsyncStorage.getItem(KIS_RECENT_REACTIONS_KEY),
        ]);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setInternalRecents(parsed.filter((e) => typeof e === 'string'));
          }
        }
        if (rawReactions) {
          const parsedR = JSON.parse(rawReactions);
          if (Array.isArray(parsedR)) {
            setReactionRecents(parsedR.filter((e) => typeof e === 'string'));
          }
        }
      } catch (err) {
        console.warn('[EmojiPicker] Failed to load recent emojis', err);
      } finally {
        setLoadingRecents(false);
      }
    };

    loadRecents();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // If external recentEmojis were provided, stop loading immediately
  useEffect(() => {
    if (recentEmojis) setLoadingRecents(false);
  }, [recentEmojis]);

  const effectiveRecents = recentEmojis ?? internalRecents;

  // Build categories only when recents change
  const categories = useMemo(
    () =>
      buildCategories(effectiveRecents).map((cat) => ({
        ...cat,
        emojis: Array.from(new Set(cat.emojis)), // remove duplicates
      })),
    [effectiveRecents],
  );

  // All emojis flattened for search
  const allEmojis = useMemo(() => {
    const flat: string[] = [];
    categories.forEach((cat) => {
      if (cat.id !== 'recents') flat.push(...cat.emojis);
    });
    return Array.from(new Set(flat));
  }, [categories]);

  // Search results
  const searchResults = useMemo(() => {
    const q = emojiSearchQuery.trim().toLowerCase();
    if (!q) return [];
    return allEmojis.filter((e) => {
      if (e.toLowerCase().includes(q)) return true;
      const name = emojiNameFor(e);
      return name.includes(q);
    });
  }, [emojiSearchQuery, allEmojis]);

  // Build SectionList sections (virtualized)
  const sections = useMemo(
    () =>
      categories.map((cat) => ({
        id: cat.id,
        title: cat.label,
        data: chunkEmojisToRows(cat.emojis, cat.id),
      })),
    [categories],
  );

  const handleEmojiPress = (emoji: string) => {
    onSelectEmoji(emoji);

    // Update reaction recents
    setReactionRecents((prev) => {
      const filtered = prev.filter((e) => e !== emoji);
      const updated = [emoji, ...filtered].slice(0, MAX_RECENT_REACTIONS);
      AsyncStorage.setItem(KIS_RECENT_REACTIONS_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });

    if (recentEmojis) return;

    setInternalRecents((prev) => {
      const filtered = prev.filter((e) => e !== emoji);
      const updated = [emoji, ...filtered].slice(0, MAX_RECENT_EMOJIS);

      AsyncStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(updated)).catch(
        (err) =>
          console.warn('[EmojiPicker] Failed to save recent emojis', err),
      );

      return updated;
    });
  };

  const renderEmojiButton = (emoji: string, keyPrefix: string) => (
    <Pressable
      key={`${keyPrefix}-${emoji}`}
      onPress={() => handleEmojiPress(emoji)}
      style={{
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        margin: 4,
        borderRadius: 20,
      }}
      android_ripple={{ color: palette.divider, borderless: true }}
    >
      <Text style={{ fontSize: 30 }}>{emoji}</Text>
    </Pressable>
  );

  const renderRow = ({ item, section }: { item: EmojiRow; section: { id: string } }) => (
    <View style={{ flexDirection: 'row', flexWrap: 'nowrap' }}>
      {item.emojis.map((emoji) => renderEmojiButton(emoji, section.id))}
    </View>
  );

  const renderSectionHeader = ({ section }: { section: any }) => (
    <Text
      style={{
        color: palette.subtext,
        fontSize: 14,
        marginVertical: 4,
        paddingHorizontal: 8,
      }}
    >
      {section.title}
    </Text>
  );

  // Skeleton while recents are loading (to give immediate feedback)
  if (loadingRecents) {
    return (
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: palette.divider,
          backgroundColor: palette.chatComposerBg ?? palette.card,
          paddingVertical: 8,
          paddingHorizontal: 8,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <ActivityIndicator size="small" color={palette.subtext} />
          <Text style={{ marginLeft: 8, color: palette.subtext }}>
            Loading emojis…
          </Text>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {Array.from({ length: 24 }).map((_, idx) => (
            <View
              key={idx}
              style={{
                width: 40,
                height: 40,
                margin: 4,
                borderRadius: 20,
                backgroundColor: palette.skeleton ?? '#ddd',
              }}
            />
          ))}
        </View>
      </View>
    );
  }

  const recentDisplay = reactionRecents.slice(0, RECENT_REACTIONS_DISPLAY);

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: palette.divider,
        backgroundColor: palette.chatComposerBg ?? palette.card,
        paddingVertical: 4,
      }}
    >
      {/* GAP 2: Search bar */}
      <View style={{ paddingHorizontal: 8, paddingTop: 6, paddingBottom: 4 }}>
        <TextInput
          value={emojiSearchQuery}
          onChangeText={setEmojiSearchQuery}
          placeholder="Search emoji…"
          placeholderTextColor={palette.subtext}
          style={{
            backgroundColor: palette.input ?? '#F5F5F5',
            borderRadius: 20,
            paddingHorizontal: 12,
            height: 36,
            fontSize: 14,
            color: palette.text,
          }}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>

      {/* GAP 2: Search results */}
      {emojiSearchQuery.trim().length > 0 ? (
        <View style={{ paddingHorizontal: 8 }}>
          {searchResults.length === 0 ? (
            <Text style={{ color: palette.subtext, fontSize: 13, padding: 8 }}>
              No emojis found
            </Text>
          ) : (
            <ScrollView
              horizontal={false}
              style={{ maxHeight: 200 }}
              contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap' }}
            >
              {searchResults.map((emoji) => renderEmojiButton(emoji, 'search'))}
            </ScrollView>
          )}
        </View>
      ) : (
        <>
          {/* GAP 2: Recently used row */}
          {recentDisplay.length > 0 && (
            <View style={{ paddingHorizontal: 8, marginBottom: 4 }}>
              <Text
                style={{
                  color: palette.subtext,
                  fontSize: 13,
                  marginVertical: 4,
                  paddingHorizontal: 4,
                  fontWeight: '600',
                }}
              >
                Recently used
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row' }}>
                  {recentDisplay.map((emoji) => renderEmojiButton(emoji, 'recents-row'))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Full section list */}
          <SectionList
            sections={sections}
            keyExtractor={(item: EmojiRow) => item.key}
            renderItem={renderRow}
            renderSectionHeader={renderSectionHeader}
            style={{ maxHeight: 220 }}
            contentContainerStyle={{ paddingBottom: 8 }}
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            windowSize={7}
            removeClippedSubviews
            showsVerticalScrollIndicator={true}
          />
        </>
      )}
    </View>
  );
};
