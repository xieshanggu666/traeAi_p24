const { v4: uuidv4 } = require('uuid');

const nicknames = [
  '神秘旅人', '星空漫步者', '月光下的猫', '海风轻拂', '追梦人',
  '孤独患者', '云端之上', '时光旅人', '深海的鱼', '蒲公英',
  '雨后彩虹', '落叶归根', '北极星', '城南旧事', '清晨露珠',
  '夕阳西下', '微风拂面', '远方的诗', '静谧时光', '梦里花开',
  '轻舞飞扬', '漫步云端', '雨后春笋', '阳光明媚', '月色朦胧',
  '风中追风', '雨后初晴', '静待花开', '时光静好', '浅笑安然'
];

const avatars = [
  '🐱', '🐶', '🐼', '🦊', '🐰', '🐨', '🐯', '🦁', '🐮', '🐷',
  '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦄', '🐝', '🦋', '🐙',
  '🐳', '🐬', '🐠', '🐡', '🦀', '🐚', '🌙', '⭐', '🌈', '🌸'
];

function generateUUID() {
  return uuidv4();
}

function generateNickname() {
  return nicknames[Math.floor(Math.random() * nicknames.length)];
}

function generateAvatar() {
  return avatars[Math.floor(Math.random() * avatars.length)];
}

function generateResponse(success, data = null, message = '') {
  return {
    success,
    data,
    message
  };
}

module.exports = {
  generateUUID,
  generateNickname,
  generateAvatar,
  generateResponse
};
