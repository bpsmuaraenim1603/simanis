import React from 'react'
import BPS from '../../public/BPS.png'
import AuthScreen from './AuthScreen'

function HomeScreen() {
  return (
    <div>
      <div className='bg-orange-900 flex justify-start px-4 py-3 w-full h-[80px]'>
          <img alt="Badan Pusat Statistik" className='h-[60px]' src={BPS.src}></img>
          <div className='uppercase text-white space-y-0 font-Poppins font-semibold italic pt-1'>
            <h1>Badan Pusat Statistik <br /> Kabupaten Muara Enim</h1>
          </div>
      </div>
      <div className='bg-orange-500 w-full min-h-screen flex justify-between py-[100px] px-[100px]'>
        <div className='px-4 py-20 space-y-8'>
            <h1 className='text-white text-4xl font-semibold font-Poppins'>Selamat Datang di SIMANIS!</h1>
            <span className='text-white text-xl font-Poppins'>Sistem Integrasi Monitoring Administrasi dan Teknis</span>
            <a type="submit" href="https://muaraenimkab.bps.go.id/" target="_blank" className='flex flex-row items-center justify-center py-3 px-6 rounded-lg cursor-pointer bg-orange-900 shadow-md min-h-[45px] w-[150px] text-[16px] text-white font-Poppins font-semibold'>Contact Us</a>
        </div>
        <div>
          <AuthScreen/>
        </div>
      </div>
    </div>
  )
}

export default HomeScreen