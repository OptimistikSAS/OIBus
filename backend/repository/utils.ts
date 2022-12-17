const CHARACTER_SET =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const RANDOM_LENGTH = 16;
export const generateRandomId = (): string => {
  let randomId = "";
  for (let i = 0; i < RANDOM_LENGTH; i += 1) {
    randomId += CHARACTER_SET[Math.floor(Math.random() * CHARACTER_SET.length)];
  }
  return randomId;
};
