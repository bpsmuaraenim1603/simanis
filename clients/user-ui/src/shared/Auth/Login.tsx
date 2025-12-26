import styles from "@/src/utils/style";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AiFillGithub,
  AiOutlineEye,
  AiOutlineEyeInvisible,
} from "react-icons/ai";
import { FcGoogle } from "react-icons/fc";
import { useState } from "react";
import toast from "react-hot-toast";
import { useMutation } from "@apollo/client";
import { LOGIN_USER } from "@/src/graphql/actions/login.action";
import Cookies from "js-cookie";
import { signIn } from "next-auth/react";
import useUser from "@/src/hooks/useUser";

const formSchema = z.object({
  email: z.string().email({ message: "Email tidak valid" }),
  password: z.string().min(8, { message: "Password minimal 8 karakter" }),
});

type LoginSchema = z.infer<typeof formSchema>;

const Login = ({ setActiveState }: { setActiveState: (e: string) => void }) => {
  const { user, loading: loadingUser } = useUser();
  const [Login, { loading }] = useMutation(LOGIN_USER);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<LoginSchema>({
    resolver: zodResolver(formSchema),
  });

  const isProd = process.env.NODE_ENV === "production";
  const cookieOpts = {
    expires: 30,
    sameSite: "lax" as const,
    path: "/",
    secure: isProd,
  };

  const [show, setShow] = useState(false);

  const onSubmit = async (data: LoginSchema) => {
    const loginData = {
      email: data.email,
      password: data.password,
    };
    const response = await Login({
      variables: loginData,
    });

    if (response.data.Login.user) {
      Cookies.set("refresh_token", response.data.Login.refreshToken, cookieOpts);
      Cookies.set("access_token", response.data.Login.accessToken, cookieOpts);
      if (user?.role === "User"){
        window.location.href = "/user";
      } else if (user?.role === "Supervisor"){
        window.location.href = "/supervisor";
      } else {
        window.location.href = "/dashboard";
      }
      
      toast.success("Login Berhasil!");
    } else {
      toast.error(response.data.Login.error.message);
    }
  };

  return (
    <div className="py-2 px-4 space-y-5">
      <h1 className={`${styles.title}`}>Silahkan Login!!</h1>
      <form onSubmit={handleSubmit(onSubmit)}>
        <label className="text-[16px] font-Poppins">Masukkan emailmu</label>
        <input
          {...register("email")}
          type="email"
          placeholder="muaraenim@gmail.com"
          className={`${styles.input} shadow-sm`}
        />
        {errors.email && (
          <span className="text-red-500 block mt-1">
            {`${errors.email.message}`}
          </span>
        )}
        <div className="w-full mt-5 relative mb-1">
          <label htmlFor="password" className="text-[16px] font-Poppins">
            Masukkan passwordmu
          </label>
          <input
            {...register("password")}
            type={!show ? "password" : "text"}
            placeholder="qwerty12345"
            className={`${styles.input} shadow-sm`}
          />
          {errors.password && (
            <span className="text-red-500 block mt-1">
              {`${errors.password.message}`}
            </span>
          )}
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
        <div className="w-full mt-5">
          <a
            onClick={() => setActiveState("ForgotPassword")}
            className={
              "text-[16px] font-Poppins text-xs text-[#2190ff] block text-right cursor-pointer"
            }
          >
            Lupa Paswword?
          </a>
          <input
            type="submit"
            value="Login"
            disabled={isSubmitting || loading}
            className={`${styles.button} my-2 text-white`}
          />
        </div>
        {/* <h5 className="text-center pt-6 font-Poppins text-[14px]">
          Or join with
        </h5> */}
        {/* <div
          className="flex items-center justify-center my-2"
          onClick={() => signIn()}
        > */}
        {/* <FcGoogle size={30} className="cursor-pointer mr-2" /> */}
        {/* <AiFillGithub size={30} className="cursor-pointer ml-2" /> */}
        {/* </div> */}
        <h5 className="text-center pt-2 font-Poppins text-[14px] ">
          Belum punya akun?
          <span
            className="text-[#2190ff] pl-1 cursor-pointer"
            onClick={() => setActiveState("Signup")}
          >
            Daftar
          </span>
        </h5>
        <br />
      </form>
    </div>
  );
};

export default Login;
