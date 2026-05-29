export interface BirthdayPerson {
  name: string;
  roastMessage: string;
  birthDate: string;
}

export interface Sender {
  id: string;
  name: string;
  message: string;
  special: 'CS' | 'None';
}

export interface PolaroidImage {
  id: string;
  url: string;
  caption: string;
  roastBack?: string;
}

export const defaultBirthdayPerson: BirthdayPerson = {
  name: "Chotu",
  roastMessage: "Abe nalle, ek aur saal barbaad kar diya tune. Zindagi mein kuch dhang ka kaam kar le ab. Chal koi na, tu jaisa bhi hai mera bhai hai. Happy Birthday! 🎉 Party de chup chap.",
  birthDate: "March 14th"
};

export const defaultSenders: Sender[] = [
  { id: '1', name: 'Ashish', message: 'sudo make-wish --name=friend --force\nconsole.log("Happy Bday bhai");', special: 'CS' },
  { id: '2', name: 'Aditya', message: 'Bhai tu sudhrega nahi na? Happy Birthday! Ghoomne chalte hain.', special: 'None' },
  { id: '3', name: 'Rohit', message: 'Aaj toh naha leta gadhe! Chal khush reh, Happy bday.', special: 'None' }
];

export const defaultPolaroids: PolaroidImage[] = [
  { 
    id: 'p1', 
    url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400&h=400&fit=crop',
    caption: 'Birthday Fun',
    roastBack: 'Yeh wala din yaad hai? Tu itna hasa tha ke paani aa gaya aankh mein 😂'
  },
  { 
    id: 'p2', 
    url: 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=400&h=400&fit=crop',
    caption: 'Party Time',
    roastBack: 'Iss photo mein tu bilkul gadha lag raha hai, par pyaara gadha 🫏❤️'
  },
  { 
    id: 'p3', 
    url: 'https://images.unsplash.com/photo-1576607552471-f6cc9ef0d473?w=400&h=400&fit=crop',
    caption: 'Happy Moments',
    roastBack: 'Yeh moment toh sach mein fire tha! Happy Birthday bhai 🔥'
  }
];
