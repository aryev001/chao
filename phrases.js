// phrases.js — hand-checked shop & street Vietnamese.
// {A} = what you call them (chị, anh, cô…), {S} = what you call yourself (em, cháu…)
// {north|south} = regional word choice. "ạ" is dropped automatically when talking to someone younger.

export const CATEGORIES = [
  { id: 'app', label: 'Start here' },
  { id: 'basics', label: 'Basics' },
  { id: 'shop', label: 'Shopping' },
  { id: 'pay', label: 'Paying' },
  { id: 'food', label: 'Food & drink' },
  { id: 'move', label: 'Getting around' },
  { id: 'help', label: 'Help' },
];

export const PHRASES = [
  // Start here — explain the app so the shopkeeper speaks clearly
  { cat: 'app', en: 'I’m using a translation app', alts: ['i am using a translator', 'this is a translation app'], vi: '{S} đang dùng ứng dụng dịch ạ.' },
  { cat: 'app', en: 'Please speak into the phone', alts: ['speak into the phone', 'talk into the phone', 'speak to the phone'], vi: '{A} nói vào điện thoại này giúp {S} với ạ.' },
  { cat: 'app', en: 'Please speak in short sentences', alts: ['short sentences', 'speak one sentence at a time'], vi: '{A} nói từng câu ngắn giúp {S} với ạ.' },
  { cat: 'app', en: 'Could you say that again?', alts: ['say again', 'say that again', 'repeat please', 'can you repeat that', 'pardon', 'sorry what'], vi: '{A} nói lại giúp {S} được không ạ?' },
  { cat: 'app', en: 'Could you speak more slowly?', alts: ['speak slowly', 'slowly', 'can you speak slower', 'slower please'], vi: '{A} nói chậm một chút được không ạ?' },
  { cat: 'app', en: 'Could you write it down?', alts: ['write it down', 'can you write it', 'can you type it'], vi: '{A} viết ra giúp {S} được không ạ?' },

  // Basics
  { cat: 'basics', en: 'Hello', alts: ['hi', 'hello there', 'good morning', 'good afternoon', 'good evening'], vi: 'Chào {A} ạ.' },
  { cat: 'basics', en: 'Excuse me! (to get attention)', alts: ['excuse me', 'hello excuse me'], vi: '{A} ơi!' },
  { cat: 'basics', en: 'Thank you', alts: ['thanks', 'thank you so much', 'thank you very much', 'thanks a lot'], vi: 'Cảm ơn {A} nhiều ạ.' },
  { cat: 'basics', en: 'Sorry', alts: ['i am sorry', 'sorry about that', 'my apologies'], vi: 'Xin lỗi {A} ạ.' },
  { cat: 'basics', en: 'Yes', alts: ['yeah', 'yes please', 'yep'], vi: '{Vâng ạ|Dạ}.' },
  { cat: 'basics', en: 'Okay, that works', alts: ['ok', 'okay', 'that works', 'fine', 'alright', 'sounds good', 'deal', 'ok deal'], vi: 'Dạ, được ạ.' },
  { cat: 'basics', en: 'No, thank you', alts: ['no thanks', 'no thank you', 'no'], vi: 'Dạ thôi, {S} cảm ơn ạ.' },
  { cat: 'basics', en: 'I don’t understand', alts: ['i do not understand', 'sorry i do not understand', 'i did not understand'], vi: '{S} không hiểu ạ.' },
  { cat: 'basics', en: 'I don’t speak much Vietnamese', alts: ['i do not speak vietnamese', 'my vietnamese is not good', 'i can not speak vietnamese'], vi: '{S} không nói được nhiều tiếng Việt ạ.' },
  { cat: 'basics', en: 'Do you speak English?', alts: ['do you speak english', 'english'], vi: '{A} có nói được tiếng Anh không ạ?' },
  { cat: 'basics', en: 'Goodbye', alts: ['bye', 'see you', 'see you later'], vi: '{S} chào {A} ạ.' },

  // Shopping
  { cat: 'shop', en: 'How much is this?', alts: ['how much', 'how much does this cost', 'what is the price', 'price', 'how much is it', 'how much is that', 'how much for this', 'what does this cost'], vi: '{A} ơi, cái này bao nhiêu tiền ạ?' },
  { cat: 'shop', en: 'How much for one?', alts: ['how much each', 'price for one', 'how much for one piece'], vi: 'Bao nhiêu tiền một cái ạ?' },
  { cat: 'shop', en: 'How much for two?', alts: ['price for two', 'how much for both'], vi: 'Hai cái bao nhiêu tiền ạ?' },
  { cat: 'shop', en: 'That’s too expensive', alts: ['too expensive', 'that is expensive', 'expensive', 'that is a lot', 'way too much'], vi: '{Đắt|Mắc} quá {A} ơi.' },
  { cat: 'shop', en: 'Can you lower the price a little?', alts: ['can you give me a discount', 'discount', 'cheaper', 'can you make it cheaper', 'lower the price', 'any discount', 'can you go lower', 'can you reduce the price'], vi: '{A} bớt cho {S} một chút được không ạ?' },
  { cat: 'shop', en: 'Is that your best price?', alts: ['best price', 'is that the lowest', 'final price', 'can you not go lower', 'is that the lowest price'], vi: '{A} không bớt được nữa ạ?' },
  { cat: 'shop', en: 'If I buy more, can you give a better price?', alts: ['discount if i buy more', 'i will buy several', 'discount for two'], vi: '{S} mua nhiều, {A} bớt cho {S} được không ạ?' },
  { cat: 'shop', en: 'I’m just looking', alts: ['just looking', 'i am only looking', 'i am just browsing', 'only looking'], vi: '{S} xem thôi ạ.' },
  { cat: 'shop', en: 'Can I see this one?', alts: ['can i see this', 'can i look at this', 'show me this', 'can i see that one', 'can i see it'], vi: '{A} cho {S} xem cái này được không ạ?' },
  { cat: 'shop', en: 'Do you have this?', alts: ['do you sell this', 'do you have one of these'], vi: '{A} có cái này không ạ?' },
  { cat: 'shop', en: 'Can I try it on?', alts: ['can i try this on', 'can i try it', 'try on', 'where can i try it on'], vi: '{S} mặc thử được không ạ?' },
  { cat: 'shop', en: 'Can I try these shoes?', alts: ['can i try the shoes', 'try these shoes'], vi: '{S} đi thử đôi này được không ạ?' },
  { cat: 'shop', en: 'Do you have a bigger size?', alts: ['bigger size', 'larger size', 'bigger', 'do you have this in a bigger size', 'a size up'], vi: '{A} có size lớn hơn không ạ?' },
  { cat: 'shop', en: 'Do you have a smaller size?', alts: ['smaller size', 'smaller', 'a size down'], vi: '{A} có size nhỏ hơn không ạ?' },
  { cat: 'shop', en: 'Do you have other colours?', alts: ['other colors', 'another color', 'different color', 'other colours', 'do you have it in another color'], vi: '{A} có màu khác không ạ?' },
  { cat: 'shop', en: 'I’ll take this one', alts: ['i will take it', 'i will take this', 'i will buy it', 'i will buy this', 'i take it', 'this one'], vi: '{S} lấy cái này ạ.' },
  { cat: 'shop', en: 'I’ll take two', alts: ['i will take two', 'two please', 'i want two'], vi: '{S} lấy hai cái ạ.' },
  { cat: 'shop', en: 'I’ll look around and come back', alts: ['i will come back later', 'maybe later', 'i will think about it', 'let me think about it', 'i will come back'], vi: 'Để {S} đi xem thêm rồi quay lại ạ.' },
  { cat: 'shop', en: 'Could I have a bag?', alts: ['can i have a bag', 'bag', 'a bag', 'plastic bag'], vi: '{A} cho {S} xin cái túi được không ạ?' },
  { cat: 'shop', en: 'Could you wrap it as a gift?', alts: ['gift wrap', 'wrap it', 'can you wrap it'], vi: '{A} gói quà giúp {S} được không ạ?' },

  // Paying
  { cat: 'pay', en: 'Can I pay by card?', alts: ['card', 'do you take cards', 'credit card', 'can i pay with card', 'do you accept card'], vi: '{S} trả bằng thẻ được không ạ?' },
  { cat: 'pay', en: 'Can I pay by bank transfer / QR?', alts: ['can i pay by qr', 'qr code', 'bank transfer', 'can i scan', 'can i scan the qr'], vi: '{S} chuyển khoản được không ạ?' },
  { cat: 'pay', en: 'I’ll pay cash', alts: ['cash', 'i will pay in cash'], vi: '{S} trả tiền mặt ạ.' },
  { cat: 'pay', en: 'Do you have change?', alts: ['do you have change', 'i only have a big note', 'do you have smaller notes', 'can you break this'], vi: '{A} có tiền lẻ để {trả lại|thối} không ạ?' },
  { cat: 'pay', en: 'Could I have a receipt?', alts: ['receipt', 'can i get a receipt', 'invoice'], vi: '{A} cho {S} xin hóa đơn được không ạ?' },
  { cat: 'pay', en: 'I think the change is short', alts: ['the change is wrong', 'wrong change', 'i think you gave me the wrong change'], vi: 'Hình như {A} {trả lại|thối} thiếu tiền rồi ạ.' },
  { cat: 'pay', en: 'How much altogether?', alts: ['how much in total', 'total', 'how much is everything', 'altogether'], vi: 'Tất cả bao nhiêu tiền ạ?' },

  // Food & drink
  { cat: 'food', en: 'One of this, please', alts: ['one of these', 'i want this', 'this one please', 'one please', 'i will have this'], vi: 'Cho {S} một phần này ạ.' },
  { cat: 'food', en: 'Could I see the menu?', alts: ['menu', 'menu please', 'can i see the menu'], vi: 'Cho {S} xem thực đơn ạ.' },
  { cat: 'food', en: 'What do you recommend?', alts: ['what is good here', 'what is popular', 'what should i order', 'what is the best dish'], vi: 'Ở đây món nào ngon nhất ạ?' },
  { cat: 'food', en: 'I’m vegetarian', alts: ['i am vegetarian', 'vegetarian', 'i only eat vegetarian'], vi: '{S} ăn chay ạ.' },
  { cat: 'food', en: 'No meat, please', alts: ['no meat', 'without meat', 'i do not eat meat'], vi: 'Cho {S} món không có thịt ạ.' },
  { cat: 'food', en: 'I don’t eat beef', alts: ['no beef', 'i do not eat beef'], vi: '{S} không ăn thịt bò ạ.' },
  { cat: 'food', en: 'I don’t eat pork', alts: ['no pork', 'i do not eat pork'], vi: '{S} không ăn {thịt lợn|thịt heo} ạ.' },
  { cat: 'food', en: 'Not spicy, please', alts: ['not spicy', 'no chili', 'no chilli', 'no spice', 'mild'], vi: 'Cho {S} không cay ạ.' },
  { cat: 'food', en: 'I can’t eat spicy food', alts: ['i can not eat spicy food', 'i can not eat spicy'], vi: '{S} không ăn được cay ạ.' },
  { cat: 'food', en: 'Does this have peanuts?', alts: ['peanuts', 'is there peanut in this', 'does it have nuts'], vi: 'Món này có {lạc|đậu phộng} không ạ?' },
  { cat: 'food', en: 'I’m allergic to peanuts', alts: ['i am allergic to peanuts', 'peanut allergy', 'nut allergy'], vi: '{S} bị dị ứng {lạc|đậu phộng} ạ.' },
  { cat: 'food', en: 'No ice, please', alts: ['no ice', 'without ice'], vi: 'Cho {S} không đá ạ.' },
  { cat: 'food', en: 'Less sugar, please', alts: ['less sugar', 'not too sweet', 'a little sugar'], vi: 'Cho {S} ít đường ạ.' },
  { cat: 'food', en: 'One iced milk coffee, please', alts: ['iced coffee with milk', 'iced milk coffee', 'milk coffee', 'ca phe sua da'], vi: 'Cho {S} một {cốc|ly} cà phê sữa đá ạ.' },
  { cat: 'food', en: 'A bottle of water, please', alts: ['water', 'water please', 'bottle of water', 'a water'], vi: 'Cho {S} một chai {nước lọc|nước suối} ạ.' },
  { cat: 'food', en: 'To take away', alts: ['takeaway', 'take away', 'to go', 'pack it', 'can you pack it'], vi: '{S} mang về ạ.' },
  { cat: 'food', en: 'To eat here', alts: ['eat here', 'for here', 'dine in'], vi: '{S} ăn ở đây ạ.' },
  { cat: 'food', en: 'It’s delicious!', alts: ['delicious', 'very tasty', 'so good', 'yummy', 'this is delicious', 'tasty'], vi: 'Ngon quá ạ!' },
  { cat: 'food', en: 'The bill, please', alts: ['bill please', 'check please', 'the bill', 'the check', 'can i pay now'], vi: '{A} ơi, tính tiền giúp {S} ạ.' },

  // Getting around
  { cat: 'move', en: 'Where is the toilet?', alts: ['toilet', 'restroom', 'bathroom', 'where is the bathroom', 'washroom', 'where is the restroom'], vi: 'Nhà vệ sinh ở đâu ạ?' },
  { cat: 'move', en: 'Please take me to this address', alts: ['take me here', 'go to this address', 'this address', 'can you take me here'], vi: '{A} cho {S} đến địa chỉ này ạ.' },
  { cat: 'move', en: 'Stop here, please', alts: ['stop here', 'you can stop here', 'drop me here', 'here is fine'], vi: 'Cho {S} xuống ở đây ạ.' },
  { cat: 'move', en: 'Is it far?', alts: ['how far is it', 'is it far from here', 'far'], vi: 'Có xa không ạ?' },
  { cat: 'move', en: 'How do I get there?', alts: ['how do i get there', 'which way', 'how do i go there'], vi: 'Đến đó đi đường nào ạ?' },
  { cat: 'move', en: 'I’m lost', alts: ['i am lost', 'i got lost'], vi: '{S} bị lạc đường ạ.' },

  // Help
  { cat: 'help', en: 'Could you help me?', alts: ['can you help me', 'help me', 'i need help'], vi: '{A} giúp {S} một chút được không ạ?' },
  { cat: 'help', en: 'Where is a pharmacy?', alts: ['pharmacy', 'chemist', 'where can i buy medicine'], vi: '{Hiệu thuốc|Nhà thuốc} ở đâu ạ?' },
  { cat: 'help', en: 'Where is the hospital?', alts: ['hospital', 'where is a hospital'], vi: 'Bệnh viện ở đâu ạ?' },
  { cat: 'help', en: 'Please call an ambulance!', alts: ['call an ambulance', 'ambulance'], vi: 'Gọi cấp cứu giúp {S} với!' },
  { cat: 'help', en: 'Please call the police!', alts: ['call the police', 'police'], vi: 'Gọi công an giúp {S} với!' },
];
