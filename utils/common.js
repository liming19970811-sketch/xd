const USER_KEY = 'user_data';

export function initUser() {
  let user = uni.getStorageSync(USER_KEY);
  if (!user) {
    user = {
      isVip: false,
      leftCount: 2,
      shareCode: randomCode(6),
      inviteCount: 0
    };
    uni.setStorageSync(USER_KEY, user);
  }
  return user;
}

export function saveUser(user) {
  uni.setStorageSync(USER_KEY, user);
}

function randomCode(len) {
  let chars = 'ABCDEFGHJKMNPQRSTWXYZ23456789';
  let res = '';
  for (let i=0; i<len; i++) {
    res += chars[Math.floor(Math.random() * chars.length)];
  }
  return res;
}

export function useCount(num = 1) {
  let user = initUser();
  if (user.isVip) return true;
  if (user.leftCount >= num) {
    user.leftCount -= num;
    saveUser(user);
    return true;
  }
  return false;
}

export function onInviteSuccess() {
  let user = initUser();
  user.leftCount += 5;
  user.inviteCount += 1;
  saveUser(user);
}

export function buyVip(typ) {
  let user = initUser();
  user.isVip = true;
  saveUser(user);
  return true;
}