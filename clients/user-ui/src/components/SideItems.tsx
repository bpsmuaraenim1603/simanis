'use client';
import Link from "next/link"

const sideItems = [
    {
        title: 'Beranda',
        url: '/',
    },
    {
        title: 'Progres',
        url: '/progess',
    },
    {
        title: 'Monitoring Petugas',
        url: '/monitoringstaff',
    },
    {
        title: 'Kendala',
        url: '/issue',
    },
    {
        title: 'ST Petugas',
        url: '/partners',
    },
    {
        title: 'Pengajuan Honor',
        url: '/spj',
    },
    {
        title: 'Tentang Kami',
        url: '/about',
    },
]

const SideItems = ({activeItem = 0}:{activeItem?:number}) => {
  return (
    <div>
        {
            sideItems.map((item, index) => (
                <Link
                key={item.url}
                href={item.url}
                className={
                    `px-5 text-[18px] font-Poppins font-[500] ${
                        activeItem === index && 'text-[#37b668]'
                    }`
                }
                >
                    {item.title}
                </Link>
            ))

        }
    </div>
  )
}

export default SideItems;