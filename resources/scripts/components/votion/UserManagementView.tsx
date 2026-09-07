import React from 'react';

export const UserManagementView: React.FC = () => {
    return (
        <div className="w-full min-h-screen bg-[#000000] text-[#F3F4F6] font-sans px-6 py-8">
            <div className="max-w-[1324px] mx-auto">
                <div className="border-b border-[#262626] pb-6 mb-8">
                    <h1 className="text-3xl font-serif font-normal text-[#FFFFFF] m-0">User Management</h1>
                    <p className="text-xs text-[#A0A0A0] mt-1.5 m-0">Accounts, administrative roles, and organization permissions</p>
                </div>

                <div className="bg-[#121212] border border-[#262626] rounded-md overflow-hidden">
                    <table className="w-full text-left text-xs text-[#F3F4F6]">
                        <thead className="bg-[#0A0A0A] border-b border-[#262626] text-[10px] font-mono uppercase text-[#656B6B]">
                            <tr>
                                <th className="py-3 px-4">Username</th>
                                <th className="py-3 px-4">Email Address</th>
                                <th className="py-3 px-4">Role</th>
                                <th className="py-3 px-4">2FA Security</th>
                                <th className="py-3 px-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#262626]">
                            <tr className="hover:bg-[#16161A]">
                                <td className="py-3 px-4 font-semibold text-[#FFFFFF]">lunaradmin</td>
                                <td className="py-3 px-4 text-[#A0A0A0]">admin@lunar.local</td>
                                <td className="py-3 px-4">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#FFFFFF] text-[#000000] font-bold">Root Admin</span>
                                </td>
                                <td className="py-3 px-4 text-[#10B981] font-mono">Active</td>
                                <td className="py-3 px-4 text-right">
                                    <a href="/admin/users" className="text-xs text-[#FFFFFF] underline no-underline hover:underline">Edit User</a>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
