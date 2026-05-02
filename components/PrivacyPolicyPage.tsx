import React from 'react';
import { Icons } from '../constants';

const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div className="text-center space-y-4">
        <div className="inline-flex p-3 rounded-2xl bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">
          <Icons.checkCircle className="h-10 w-10" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Privacy Policy</h1>
        <p className="text-slate-500 dark:text-slate-400">Last updated: March 5, 2026</p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 sm:p-8 space-y-6 border border-slate-200 dark:border-slate-700">
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 text-sm">1</span>
            Introduction
          </h2>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            Welcome to Mira Attendance. We are committed to protecting your personal information and your right to privacy. If you have any questions or concerns about our policy, or our practices with regards to your personal information, please contact us.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 text-sm">2</span>
            Information We Collect
          </h2>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            We collect personal information that you voluntarily provide to us when you register on the application, express an interest in obtaining information about us or our products and services, or otherwise when you contact us.
          </p>
          <ul className="list-disc list-inside text-slate-600 dark:text-slate-300 space-y-2 ml-4">
            <li>Personal Data: Name, PIN, Email, Phone Number, Branch, and Year.</li>
            <li>Biometric Data: Facial recognition data for attendance marking.</li>
            <li>Usage Data: Log data, device information, and location data (when marking attendance).</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 text-sm">3</span>
            How We Use Your Information
          </h2>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            We use personal information collected via our application for a variety of business purposes described below:
          </p>
          <ul className="list-disc list-inside text-slate-600 dark:text-slate-300 space-y-2 ml-4">
            <li>To facilitate account creation and logon process.</li>
            <li>To mark and track attendance using facial recognition.</li>
            <li>To send administrative information to you.</li>
            <li>To respond to user inquiries and offer support.</li>
            <li>To generate reports for academic and administrative purposes.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 text-sm">4</span>
            Data Security
          </h2>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            We have implemented appropriate technical and organizational security measures designed to protect the security of any personal information we process. However, please also remember that we cannot guarantee that the internet itself is 100% secure.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 text-sm">5</span>
            Your Privacy Rights
          </h2>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            In some regions, you have certain rights under applicable data protection laws. These may include the right to request access and obtain a copy of your personal information, to request rectification or erasure, and to restrict the processing of your personal information.
          </p>
        </section>

        <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
            If you have questions or comments about this policy, you may email us at privacy@miraattendance.com
          </p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
