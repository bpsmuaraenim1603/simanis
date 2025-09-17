// src/app/HomeScreen.tsx
import React from 'react'
import BPS from '../../public/BPS.png'
import AuthScreen from './AuthScreen'

function HomeScreen() {
  return (
    <div className="w-full">
      {/* Header */}
      <div className="bg-orange-900 w-full">
        <div className="max-w-screen-xl px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3 sm:gap-4">
          <img
            alt="Badan Pusat Statistik"
            src={BPS.src}
            className="h-10 sm:h-12 w-auto"
          />
          <h1 className="uppercase text-white font-Poppins font-semibold italic leading-tight text-sm sm:text-base lg:text-lg">
            Badan Pusat Statistik <br className="hidden sm:block" /> Kabupaten Muara Enim
          </h1>
        </div>
      </div>

      {/* Hero */}
      <div className="bg-orange-500 w-full min-h-screen">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 lg:py-20 flex flex-col items-center gap-8 lg:gap-20 lg:flex lg:flex-row lg:justify-between">
          
          {/* Teks & CTA */}
          <div className="w-full text-center space-y-4 sm:space-y-6">
            <h2 className="text-white text-2xl sm:text-3xl lg:text-4xl font-semibold font-Poppins">
              Selamat Datang di SIMANIS!
            </h2>
            <p className="text-white text-base sm:text-lg font-Poppins">
              Sistem Integrasi Monitoring Administrasi dan Teknis
            </p>
            <a
              href="https://muaraenimkab.bps.go.id/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center py-3 px-6 rounded-lg cursor-pointer bg-orange-900 shadow-md min-h-[45px] w-full sm:w-auto min-w-[150px] text-[16px] text-white font-Poppins font-semibold"
            >
              Contact Us
            </a>
          </div>

          <div className="w-full max-w-md">
            <AuthScreen />
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomeScreen
