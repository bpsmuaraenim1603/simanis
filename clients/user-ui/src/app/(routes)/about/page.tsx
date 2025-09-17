import React from "react";

const About = () => {
  return (
    <div className="min-h-screen bg-white text-gray-800 font-Poppins">
      <div className="max-w-screen-md mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-6">Tentang Kami</h1>
        <div className="bg-orange-100 p-4 sm:p-6 rounded-lg leading-relaxed space-y-4">
          <p>
            Kami adalah tim pengembang aplikasi yang berfokus pada penyediaan solusi digital untuk
            kebutuhan statistik dan pemantauan data lapangan. Dengan semangat inovasi dan akurasi,
            kami berupaya menghadirkan aplikasi yang andal dan mudah digunakan untuk membantu berbagai
            pihak dalam pengambilan keputusan berbasis data.
          </p>
          <p>
            Aplikasi ini dirancang untuk memudahkan pengawasan kinerja petugas lapangan, manajemen
            kegiatan survei, serta penyampaian laporan yang efisien. Kami terus mengembangkan fitur
            dan memperbaiki sistem agar dapat menjawab kebutuhan yang terus berkembang.
          </p>
          <p>Terima kasih atas kepercayaan Anda menggunakan aplikasi kami.</p>
        </div>
      </div>
    </div>
  );
};

export default About;
