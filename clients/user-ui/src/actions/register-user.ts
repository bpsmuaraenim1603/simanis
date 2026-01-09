import prisma from "../lib/prismaDb";
import * as bcrypt from 'bcryptjs';

const generateRandomPassword = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+';
    const charactersLength = 8;

    const uniqueCharacters = [...Array.from(new Set(characters))];

    let password = '';
    
    for (let i = 0; i < charactersLength; i++) {
        const randomIndex = Math.floor(Math.random() * uniqueCharacters.length);
        password += uniqueCharacters[randomIndex];
    }

    return password;
};

export const registerUser = async (userData: any) => {
    const isUserExist = await prisma.user.findUnique({
        where: {
            email: userData.email,
        },
    });

    if (isUserExist) {
        return { user: isUserExist, created: false };
    }

    const password = generateRandomPassword();

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
        data: {
            name: userData.name,
            email: userData.email,
            password: hashedPassword,
            phone_number: userData.phone_number || "000000000000",
            address: userData.address || "Alamat belum diketahui",
            primaryRole: "User",
            roles: ["User"],
            limit_bill: "0",
        },
    });

    return { user, created: true };
}