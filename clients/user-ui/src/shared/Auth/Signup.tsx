import styles from "@/src/utils/style";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import { useState } from "react";
import { useMutation } from "@apollo/client";
import { REGISTER_USER } from "@/src/graphql/actions/register.action";
import toast from "react-hot-toast";

const formSchema = z
  .object({
    name: z.string().min(3, { message: "Tuliskan nama minimal 3 karakter" }),
    email: z.string().email({ message: "Email tidak valid" }),
    password: z.string().min(8, { message: "Password minimal 8 karakter" }),
    passwordConfirm: z.string(),
    phone: z.string().min(12, { message: "Nomor Telepon minimal 12 angka" }),
    address: z.string().min(5, { message: "Alamat minimal 5 karakter" }),
    signupCode: z.string().trim().regex(/^[A-Z0-9]{10}$/, { message: "Kode pendaftaran belum sesuai" }),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.passwordConfirm) {
      ctx.addIssue({
        path: ["passwordConfirm"],
        code: z.ZodIssueCode.custom,
        message: "Password tidak sama",
      });
    }
  });

type SignUpSchema = z.infer<typeof formSchema>;

const Signup = ({
  setActiveState,
}: {
  setActiveState: (e: string) => void;
}) => {
  const [registerUserMutation, { loading }] = useMutation(REGISTER_USER);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<SignUpSchema>({
    resolver: zodResolver(formSchema),
  });

  const [show, setShow] = useState(false);
  const [show2, setShow2] = useState(false);

  const onSubmit = async (data: SignUpSchema) => {
    try {
      const response = await registerUserMutation({
        variables: {
          name: data.name,
          email: data.email,
          password: data.password,
          phone: data.phone,
          address: data.address,
          signupCode: data.signupCode.trim().toUpperCase(),
        },
      });
      localStorage.setItem(
        "activation_token",
        response.data.register.activation_token
      );
      toast.success("Silahkan aktivasi akun anda melalui email!");
      reset();
      setActiveState("Verification");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="py-2 px-4 space-y-5">
      <h1 className={`${styles.title}`}>Silahkan Daftar!!</h1>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="w-full relative mb-3">
          <label className="text-[16px] font-Poppins">Masukkan namamu</label>
          <input
            {...register("name")}
            type="text"
            placeholder="Marc Spector"
            className={`${styles.input} shadow-sm`}
          />
          {errors.name && (
            <span className="text-red-500 block mt-1">
              {`${errors.name.message}`}
            </span>
          )}
        </div>
        <div className="w-full relative mb-3">
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
        </div>
        <div>
          <label className="text-[16px] font-Poppins">
            Masukkan nomor teleponmu
          </label>
          <input
            {...register("phone")}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="+62537....."
            className={`${styles.input} shadow-sm`}
          />
          {errors.phone && (
            <span className="text-red-500 block mt-1">
              {`${errors.phone.message}`}
            </span>
          )}
        </div>
        <div>
          <label className="text-[16px] font-Poppins">Masukkan alamatmu</label>
          <input
            {...register("address")}
            type="text"
            placeholder="Jl. Bersamamu"
            className={`${styles.input} shadow-sm`}
          />
          {errors.address && (
            <span className="text-red-500 block mt-1">
              {`${errors.address.message}`}
            </span>
          )}
        </div>
        <div className="w-full mt-5 relative mb-1">
          <label htmlFor="password" className="text-[16px] font-Poppins">
            Masukkan Passwordmu
          </label>
          <input
            {...register("password")}
            type={!show ? "password" : "text"}
            placeholder="qwerty12345"
            className={`${styles.input} shadow-sm`}
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
          <span className="text-red-500 mt-1">
            {`${errors.password.message}`}
          </span>
        )}
        <div className="w-full mt-5 relative mb-1">
          <label htmlFor="passwordConfirm" className="text-[16px] font-Poppins">
            Konfirmasi Passwordmu
          </label>
          <input
            {...register("passwordConfirm")}
            type={!show2 ? "password" : "text"}
            placeholder="qwerty12345"
            className={`${styles.input} shadow-sm`}
          />
          {!show2 ? (
            <AiOutlineEyeInvisible
              className="absolute bottom-3 right-2 z-1 cursor-pointer"
              size={20}
              onClick={() => setShow2(true)}
            />
          ) : (
            <AiOutlineEye
              className="absolute bottom-3 right-2 z-1 cursor-pointer"
              size={20}
              onClick={() => setShow2(false)}
            />
          )}
        </div>
        {errors.passwordConfirm && (
          <span className="text-red-500 block mt-1">
            {`${errors.passwordConfirm.message}`}
          </span>
        )}
        <div className="w-full relative mb-3 mt-4">
          <label className="text-[16px] font-Poppins">Kode Pendaftaran</label>
          <input
            {...register("signupCode")}
            type="text"
            placeholder="A1B2C3"
            maxLength={10}
            className={`${styles.input} shadow-sm uppercase`}
          />
          {errors.signupCode && (
            <span className="text-red-500 block mt-1">
              {`${errors.signupCode.message}`}
            </span>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Kode ini berubah tiap hari, silahkan minta pada admin untuk mendapatkannya.
          </p>
        </div>
        <div className="w-full mt-5">
          <input
            type="submit"
            value="Daftar"
            disabled={isSubmitting || loading}
            className={`${styles.button} my-2 text-white`}
          />
        </div>
        <h5 className="text-center pt-2 font-Poppins text-[14px]">
          Sudah punya akun?
          <span
            className="text-[#2190ff] pl-1 cursor-pointer"
            onClick={() => setActiveState("Login")}
          >
            Masuk
          </span>
        </h5>
        <br />
      </form>
    </div>
  );
};

export default Signup;
