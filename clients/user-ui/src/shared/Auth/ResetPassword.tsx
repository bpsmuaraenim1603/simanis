"use client";

import { RESET_PASSWORD } from "@/src/graphql/actions/reset-password";
import styles from "@/src/utils/style";
import { useMutation } from "@apollo/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import { z } from "zod";

const formSchema: any = z
  .object({
    password: z.string().min(8, { message: "Password minimal 8 karakter" }),
    confirmPassword: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        path: ["confirmPassword"],
        code: z.ZodIssueCode.custom,
        message: "Password tidak sama",
      });
    }
  });

type ResetPasswordSchema = z.infer<typeof formSchema>;

const ResetPassword = ({
  activationToken,
}: {
  activationToken: string | string[];
}) => {
  const [resetPassword, { loading }] = useMutation(RESET_PASSWORD);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ResetPasswordSchema>({
    resolver: zodResolver(formSchema),
  });
  const [show, setShow] = useState(false);
  const [confirmPasswordshow, setconfirmPasswordshow] = useState(false);

  const onSubmit = async (data: ResetPasswordSchema): Promise<void> => {
    try {
      await resetPassword({
        variables: {
          password: data.password,
          activationToken: activationToken,
        },
      });
      toast.success("Reset Password Berhasil!");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="w-full flex justify-center items-center h-screen bg-orange-500">
      <div className="md:w-[500px] w-full p-4 bg-white rounded-lg border-1 shadow-lg">
        <h1 className={`${styles.title} text-black`}>Reset Passwordmu</h1>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="w-full mt-5 relative mb-1">
            <label htmlFor="password" className='text-[16px] font-Poppins text-black'>
              Masukkan passwordmu
            </label>
            <input
              {...register("password")}
              type={!show ? "password" : "text"}
              placeholder="qwerty12345"
              className={`${styles.input}`}
            />
            {!show ? (
              <AiOutlineEyeInvisible
                className="absolute bottom-3 right-2 z-1 cursor-pointer"
                size={20}
                onClick={() => setShow(true)}
              />
            ) : (
              <AiOutlineEye
                className="absolute bottom-3 right-2 z-1 cursor-pointer"
                size={20}
                onClick={() => setShow(false)}
              />
            )}
          </div>
          {errors.password && (
            <span className="text-red-500">{`${errors.password.message}`}</span>
          )}
          <div className="w-full mt-5 relative mb-1">
            <label
              htmlFor="confirmPassword"
              className='text-[16px] font-Poppins text-black'
            >
              Konfirmasi passwordmu
            </label>
            <input
              {...register("confirmPassword")}
              type={!confirmPasswordshow ? "password" : "text"}
              placeholder="qwerty12345"
              className={`${styles.input}`}
            />
            {!confirmPasswordshow ? (
              <AiOutlineEyeInvisible
                className="absolute bottom-3 right-2 z-1 cursor-pointer"
                size={20}
                onClick={() => setconfirmPasswordshow(true)}
              />
            ) : (
              <AiOutlineEye
                className="absolute bottom-3 right-2 z-1 cursor-pointer"
                size={20}
                onClick={() => setconfirmPasswordshow(false)}
              />
            )}
          </div>
          {errors.confirmPassword && (
            <span className="text-red-500">{`${errors.confirmPassword.message}`}</span>
          )}
          <br />
          <input
            type="submit"
            value="Submit"
            disabled={isSubmitting || loading}
            className={`${styles.button} mt-3 text-white`}
          />
          <br />
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
