'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  FileText,
  ShieldCheck,
  Clock,
  ArrowRight,
  AlertTriangle,
  Building,
  CheckCircle2,
  Calendar,
  CreditCard,
  UserCheck,
  Send,
  RefreshCw,
  Hash,
  Laptop,
  ExternalLink,
  AlertCircle,
  Eye,
  Sparkles,
  Download,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../../../components/ui/card';
import { Button } from '../../../../../components/ui/button';
import { Badge } from '../../../../../components/ui/badge';
import { CopyButton } from '../../../../../components/ui/copy-button';
import { SignaturePad } from '../../../../../components/contracts/signature-pad';
import { SignatureOtpModal } from '../../../../../components/contracts/signature-otp-modal';
import { ContractFeeProofModal } from '../../../../../components/contracts/contract-fee-proof-modal';
import { apiClient } from '../../../../../lib/api-client';
import {
  OwnerContractStatus,
  CONTRACT_FEE_PAYMENT_STATUS_LABELS_AR,
  type OwnerContractDetailResponse,
  type RequestSignatureOtpResult,
  type SignOwnerContractResult,
  type OwnerContractFeeStatusResponse,
} from '@elmasaif/shared';
import { PROPERTY_TYPE_MAP } from '../../../../admin/owner-requests/contracts-helpers';

export interface OwnerContractSigningPageProps {
  params?: { id: string };
  initialContract?: OwnerContractDetailResponse;
}

const PLATFORM_IBAN = 'SA0380000000608010167519';

export default function OwnerContractSigningPage({
  params,
  initialContract,
}: OwnerContractSigningPageProps = {}) {
  const routeParams = useParams();
  const contractId = params?.id || (routeParams?.id as string);

  const [contract, setContract] = useState<OwnerContractDetailResponse | null>(
    initialContract || null,
  );
  const [loading, setLoading] = useState(!initialContract);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Signing interaction state
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [legalConsentChecked, setLegalConsentChecked] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isSigning, setIsSigning] = useState(false);

  // Story 7.3: Contract fee payment state
  const [feePayment, setFeePayment] = useState<OwnerContractFeeStatusResponse | null>(null);
  const [showFeeModal, setShowFeeModal] = useState(false);

  const fetchFeeStatus = useCallback(async () => {
    if (!contractId) return;
    try {
      const res = await apiClient<OwnerContractFeeStatusResponse>(`/owner/contracts/${contractId}/fee-status`);
      setFeePayment(res);
    } catch {
      // Ignore or log error
    }
  }, [contractId]);

  const fetchContract = useCallback(async () => {
    if (!contractId) return;
    try {
      setLoading(true);
      setErrorBanner(null);
      const res = await apiClient<OwnerContractDetailResponse>(`/owner/contracts/${contractId}`);
      setContract(res);
      if (res.status === OwnerContractStatus.PENDING_FEE || res.status === OwnerContractStatus.ACTIVE) {
        fetchFeeStatus();
      }
    } catch (err: any) {
      setErrorBanner(err?.message || 'فشل في تحميل تفاصيل العقد');
    } finally {
      setLoading(false);
    }
  }, [contractId, fetchFeeStatus]);

  useEffect(() => {
    if (!initialContract && contractId) {
      fetchContract();
    } else if (initialContract) {
      fetchFeeStatus();
    }
  }, [fetchContract, initialContract, contractId, fetchFeeStatus]);

  const isExpired = useMemo(() => {
    if (!contract?.expiresAt) return false;
    return new Date(contract.expiresAt).getTime() <= Date.now();
  }, [contract?.expiresAt]);

  const isPendingSignature = contract?.status === OwnerContractStatus.PENDING_SIGNATURE && !isExpired;
  const isSigned =
    contract?.status === OwnerContractStatus.PENDING_FEE ||
    contract?.status === OwnerContractStatus.ACTIVE;

  // Request OTP handler
  const handleRequestSignatureOtp = async () => {
    if (!contract || !signatureData || !legalConsentChecked || isRequestingOtp) return;

    try {
      setIsRequestingOtp(true);
      setErrorBanner(null);
      await apiClient<RequestSignatureOtpResult>(
        `/owner/contracts/${contract.id}/request-signature-otp`,
        { method: 'POST' },
      );
      setShowOtpModal(true);
    } catch (err: any) {
      setErrorBanner(err?.message || 'فشل في إرسال رمز التحقق');
    } finally {
      setIsRequestingOtp(false);
    }
  };

  // Re-request OTP for modal cooldown action
  const handleResendOtp = async () => {
    if (!contract) return;
    const res = await apiClient<RequestSignatureOtpResult>(
      `/owner/contracts/${contract.id}/request-signature-otp`,
      { method: 'POST' },
    );
    return res.resendAvailableInSeconds;
  };

  // Confirm Signature with OTP handler
  const handleConfirmSignature = async (otpCode: string) => {
    if (!contract || !signatureData) return;

    try {
      setIsSigning(true);
      setErrorBanner(null);
      const res = await apiClient<SignOwnerContractResult>(
        `/owner/contracts/${contract.id}/sign`,
        {
          method: 'POST',
          body: JSON.stringify({
            signatureData,
            otpCode,
          }),
        },
      );

      // Successfully signed: update local state to PENDING_FEE
      setContract((prev) =>
        prev
          ? {
              ...prev,
              status: res.status,
              signedAt: res.signedAt,
              expiresAt: res.expiresAt,
              signatureData,
            }
          : null,
      );

      setShowOtpModal(false);
      setSuccessBanner('تم اعتماد وتوثيق توقيعك بنجاح بموجب نظام التعاملات الإلكترونية ونظام الوساطة العقارية.');
    } catch (err: any) {
      throw err; // Re-throw so modal displays error
    } finally {
      setIsSigning(false);
    }
  };

  if (loading) {
    return (
      <div dir="rtl" className="flex flex-col items-center justify-center p-12 space-y-3">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
        <span className="text-sm font-semibold text-slate-600">جاري تحميل بيانات عقد الوساطة...</span>
      </div>
    );
  }

  if (!contract) {
    return (
      <div dir="rtl" className="p-8 space-y-4">
        <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-bold flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{errorBanner || 'عقد المالك غير موجود أو غير مصرح لك بالوصول إليه.'}</span>
        </div>
        <Link href="/app/owner/contracts">
          <Button variant="outline" size="sm" className="gap-2 text-xs">
            <ArrowRight className="w-4 h-4" />
            <span>العودة لقائمة العقود</span>
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-6 pb-12" data-testid="owner-contract-signing-page">
      {/* Header Banner */}
      <div className="rounded-2xl bg-[#1B4332] text-white p-6 shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Link
              href="/app/owner/contracts"
              className="inline-flex items-center gap-1.5 text-xs text-[#D8F3DC] hover:text-white transition-colors"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>العودة لعقود الوساطة</span>
            </Link>
            <span className="text-white/40">•</span>
            <div className="inline-flex items-center gap-1 text-[11px] font-semibold bg-white/15 text-[#D8F3DC] px-2.5 py-0.5 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>عقد وساطة معتمد • الهيئة العامة للعقار</span>
            </div>
          </div>

          <h1 className="text-2xl font-bold tracking-tight">
            مراجعة وتوقيع عقد الوساطة والتسويق العقاري
          </h1>
          <p className="text-xs text-white/80 max-w-2xl leading-relaxed">
            عقد وساطة وتسويق عقاري حصري وفق الاشتراطات واللوائح الصادرة عن الهيئة العامة للعقار في المملكة العربية السعودية.
          </p>
        </div>

        {/* Status Chip */}
        <div className="flex items-center">
          {contract.status === OwnerContractStatus.PENDING_SIGNATURE && !isExpired && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-400 text-amber-950 font-bold text-xs shadow-sm"
              data-testid="contract-status-badge"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>بانتظار التوقيع الإلكتروني</span>
            </span>
          )}
          {contract.status === OwnerContractStatus.PENDING_FEE && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-400 text-emerald-950 font-bold text-xs shadow-sm"
              data-testid="contract-status-badge"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>تم التوقيع • بانتظار سداد الرسوم</span>
            </span>
          )}
          {contract.status === OwnerContractStatus.ACTIVE && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-400 text-blue-950 font-bold text-xs shadow-sm"
              data-testid="contract-status-badge"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>عقد نشط وموثق</span>
            </span>
          )}
          {isExpired && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-400 text-rose-950 font-bold text-xs shadow-sm"
              data-testid="contract-status-badge"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>منتهي الصلاحية</span>
            </span>
          )}
        </div>
      </div>

      {/* Alerts */}
      {errorBanner && (
        <div
          className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2"
          data-testid="error-alert"
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{errorBanner}</span>
        </div>
      )}

      {successBanner && (
        <div
          className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2"
          data-testid="success-alert"
        >
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
          <span>{successBanner}</span>
        </div>
      )}

      {/* Expiry Warning when Expired */}
      {isExpired && (
        <div
          className="p-5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs leading-relaxed space-y-2"
          data-testid="expired-contract-warning"
        >
          <div className="flex items-center gap-2 font-bold text-amber-950 text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-700" />
            <span>انتهت مهلة التوقيع على هذا العقد (7 أيام)</span>
          </div>
          <p>
            انتهت مهلة التوقيع المحددة نظاماً لهذا العقد. لم تعد صلاحية التوقيع الإلكتروني سارية، يرجى تقديم طلب إدراج جديد أو التواصل مع إدارة منصة المصايف لتحديث بيانات العقد.
          </p>
        </div>
      )}

      {/* Property & Contract Overview Card */}
      <Card>
        <CardHeader className="p-5 border-b bg-slate-50/50">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Building className="w-4 h-4 text-primary" />
            <span>بيانات العقار موضوع العقد</span>
          </CardTitle>
          <CardDescription className="text-xs">
            مواصفات العقار وبيانات التعاقد المعتمدة من قبل المنصة
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="p-3 rounded-lg border bg-card space-y-1">
              <span className="text-muted-foreground">اسم العقار</span>
              <p className="font-bold text-sm text-foreground">{contract.propertyTitle || '—'}</p>
            </div>

            <div className="p-3 rounded-lg border bg-card space-y-1">
              <span className="text-muted-foreground">نوع العقار والموقع</span>
              <p className="font-bold text-sm text-foreground">
                {contract.propertyType ? PROPERTY_TYPE_MAP[contract.propertyType] || contract.propertyType : '—'}
                {' • '}
                {contract.cityName} — {contract.districtName}
              </p>
            </div>

            <div className="p-3 rounded-lg border bg-card space-y-1">
              <span className="text-muted-foreground">السعر المطلوب والمساحة</span>
              <p className="font-bold text-sm text-foreground">
                {contract.askPrice ? `${contract.askPrice.toLocaleString()} ر.س` : '—'}
                {contract.areaSquareMeters ? ` • ${contract.areaSquareMeters} م²` : ''}
              </p>
            </div>

            <div className="p-3 rounded-lg border bg-card space-y-1">
              <span className="text-muted-foreground">رسوم العقد المقررة</span>
              <p className="font-bold text-sm text-primary">
                {`${contract.contractFee.toLocaleString()} ريال سعودي`}
              </p>
              {contract.feeOverrideReason && (
                <span className="text-[11px] text-amber-700 block">
                  ملاحظة الاستثناء: {contract.feeOverrideReason}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contract Terms Legal Viewer */}
      <Card>
        <CardHeader className="p-5 border-b bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <span>بنود وشروط عقد الوساطة العقارية الرسمي</span>
            </CardTitle>
            <CardDescription className="text-xs">
              صيغة العقد النظامية المعتمدة بما يشمل التزامات الطرفين وبنود الهيئة العامة للعقار
            </CardDescription>
          </div>
          <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>تاريخ الإصدار: {new Date(contract.createdAt).toLocaleDateString('ar-SA')}</span>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          <div
            className="p-4 sm:p-6 rounded-xl bg-slate-50 border text-slate-800 text-xs sm:text-sm leading-relaxed whitespace-pre-line max-h-96 overflow-y-auto font-sans shadow-inner border-slate-200"
            data-testid="contract-terms-viewer"
          >
            {contract.contractTerms}
          </div>
        </CardContent>
      </Card>

      {/* STATE A: Signature Pad & Execution (when PENDING_SIGNATURE) */}
      {isPendingSignature && (
        <Card className="border-primary/40 shadow-sm" data-testid="signature-execution-card">
          <CardHeader className="p-5 border-b bg-primary/5">
            <CardTitle className="text-base font-bold text-primary flex items-center gap-2">
              <UserCheck className="w-4 h-4" />
              <span>تنفيذ التوقيع الإلكتروني للمالك</span>
            </CardTitle>
            <CardDescription className="text-xs">
              ارسم توقيعك الشخصي على لوحة التوقيع أدناه، ثم وافق على الإقرار النظامي لطلب رمز التحقق (OTP)
            </CardDescription>
          </CardHeader>

          <CardContent className="p-5 space-y-5">
            {/* Signature Pad Canvas */}
            <SignaturePad
              onSignatureChange={(data) => setSignatureData(data)}
              disabled={isRequestingOtp}
            />

            {/* Legal Declaration & Consent Checkbox */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={legalConsentChecked}
                  onChange={(e) => setLegalConsentChecked(e.target.checked)}
                  disabled={isRequestingOtp}
                  className="mt-1 w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                  data-testid="legal-consent-checkbox"
                />
                <span className="text-xs text-slate-700 leading-relaxed font-medium">
                  أقر أنا الموقع أدناه بصفتي المالك النظامي للعقار بصحة كافة البيانات المذكورة أعلاه، وموافقتي التامة والملزمة على كافة بنود وشروط هذا العقد وفق نظام الوساطة العقارية ولائحته التنفيذية بالمملكة العربية السعودية.
                </span>
              </label>
            </div>

            {/* Signature CTA */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>مهلة التوقيع تنتهي بتاريخ: {new Date(contract.expiresAt).toLocaleDateString('ar-SA')}</span>
              </div>

              <Button
                type="button"
                onClick={handleRequestSignatureOtp}
                disabled={!signatureData || !legalConsentChecked || isRequestingOtp}
                className="w-full sm:w-auto bg-[#1B4332] hover:bg-[#2D6A4F] text-white text-xs font-bold h-10 px-6 gap-2 shadow-sm"
                data-testid="request-otp-and-sign-cta"
              >
                {isRequestingOtp ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري إرسال رمز التحقق...</span>
                  </span>
                ) : (
                  <>
                    <span>اعتماد التوقيع وإرسال رمز التحقق</span>
                    <Send className="w-3.5 h-3.5" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STATE B: Signed Contract View & Fee Payment Transition State (when PENDING_FEE or ACTIVE) */}
      {isSigned && (
        <div className="space-y-6" data-testid="signed-contract-evidence-section">
          {/* Green Electronic Signature Stamp Card */}
          <Card className="border-emerald-300 bg-emerald-50/20 shadow-sm">
            <CardHeader className="p-5 border-b border-emerald-100 bg-emerald-50/40">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                    <span>عقد موثق وموقع إلكترونياً</span>
                  </div>
                  <h3 className="text-base font-bold text-emerald-950">
                    تم توثيق واعتماد التوقيع الإلكتروني بنجاح
                  </h3>
                </div>

                {contract.signedAt && (
                  <span className="text-xs text-emerald-800 font-semibold">
                    {`تاريخ التوقيع: ${new Date(contract.signedAt).toLocaleDateString('ar-SA')}`}
                  </span>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              {/* Evidence details grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div className="p-3 rounded-lg bg-white border border-emerald-100 space-y-1">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>اسم الموقع والصفة</span>
                  </span>
                  <p className="font-bold text-foreground text-sm">{contract.ownerName || 'مالك العقار'}</p>
                  <span className="text-[11px] text-muted-foreground">المالك النظامي</span>
                </div>

                <div className="p-3 rounded-lg bg-white border border-emerald-100 space-y-1">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5 text-emerald-600" />
                    <span>رقم الجوال الموثق بالرمز</span>
                  </span>
                  <p className="font-bold text-foreground text-sm dir-ltr text-right">
                    {contract.ownerMobile || '—'}
                  </p>
                  <span className="text-[11px] text-emerald-700 font-medium">موثق بـ OTP</span>
                </div>

                <div className="p-3 rounded-lg bg-white border border-emerald-100 space-y-1">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Laptop className="w-3.5 h-3.5 text-emerald-600" />
                    <span>بصمة الجهاز وعنوان IP</span>
                  </span>
                  <p className="font-mono text-[11px] text-slate-700 truncate" title={contract.ipAddress || '—'}>
                    {`IP: ${contract.ipAddress || '127.0.0.1'}`}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate" title={contract.userAgent || '—'}>
                    {contract.userAgent || 'متصفح موثق'}
                  </p>
                </div>

                {/* Rendered signature raster */}
                <div className="p-3 rounded-lg bg-white border border-emerald-100 flex flex-col items-center justify-center space-y-1 text-center">
                  <span className="text-[11px] text-muted-foreground">صورة التوقيع المعتمدة</span>
                  {contract.signatureData ? (
                    <img
                      src={contract.signatureData}
                      alt="توقيع المالك المعتمد"
                      className="max-h-16 w-auto object-contain border rounded p-1 bg-slate-50 shadow-inner"
                      data-testid="rendered-signature-image"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">التوقيع مسجل بالنظام</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Story 7.3: Active Certified Contract Banner */}
          {contract.status === OwnerContractStatus.ACTIVE && (
            <Card className="border-emerald-300 bg-emerald-50/40 shadow-sm" data-testid="active-contract-banner">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-600 text-white font-bold text-xs gap-1 py-1 px-3">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>عقد سارٍ ومعتمد</span>
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {contract.signedAt ? new Date(contract.signedAt).toLocaleDateString('ar-SA') : ''}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-700" />
                      <span>تم تأكيد سداد الرسوم ونشر العقار في السوق العام بنجاح</span>
                    </p>
                    <p className="text-xs text-slate-600 leading-relaxed max-w-xl">
                      تم توثيق العقد إلكترونياً واستلام رسوم التسويق، وإعلان عقارك متاح الآن للمشترين والوسطاء المعتمدين في السوق العام.
                    </p>
                  </div>

                  <div className="flex flex-wrap sm:flex-col gap-2 shrink-0">
                    {contract.listingId && (
                      <Link href={`/listings/${contract.listingId}`} target="_blank">
                        <Button
                          type="button"
                          className="w-full bg-[#1B4332] hover:bg-[#143326] text-white text-xs font-bold h-9 px-4 gap-2"
                          data-testid="view-live-listing-btn"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>عرض الإعلان في المنصة</span>
                        </Button>
                      </Link>
                    )}
                    {feePayment?.proofFileUrl && (
                      <a href={feePayment.proofFileUrl} target="_blank" rel="noopener noreferrer">
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full text-xs h-9 px-4 gap-2 border-emerald-300 text-emerald-800 hover:bg-emerald-100/50"
                          data-testid="view-payment-receipt-btn"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>إشعار التحويل البنكي</span>
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Story 7.3: Fee Payment Section (Pending Fee state) */}
          {contract.status === OwnerContractStatus.PENDING_FEE && (
            <>
              {/* State A: Proof has been rejected */}
              {feePayment?.status === 'REJECTED' && (
                <Card className="border-red-300 bg-red-50/40 shadow-sm" data-testid="fee-rejected-banner">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-red-200 pb-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive" className="font-bold text-xs gap-1 py-1 px-3">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>إشعار التحويل مرفوض</span>
                        </Badge>
                        <span className="text-xs text-red-900 font-medium">يرجى تصحيح الملاحظات وإعادة الرفع</span>
                      </div>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-800 text-xs font-bold">
                        <Clock className="w-3.5 h-3.5 text-red-700" />
                        <span>المهلة المتبقية: حتى {new Date(contract.expiresAt).toLocaleDateString('ar-SA')}</span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg bg-white border border-red-200 text-xs space-y-1.5">
                      <span className="font-bold text-red-900 block">سبب الرفض من الإدارة:</span>
                      <p className="text-slate-800 leading-relaxed" data-testid="rejection-reason-text">
                        {feePayment.rejectionReason || 'الإشعار البنكي غير مكتمل أو غير مطابق لبيانات العقد.'}
                      </p>
                    </div>

                    <div className="flex justify-end pt-1">
                      <Button
                        type="button"
                        onClick={() => setShowFeeModal(true)}
                        className="bg-red-800 hover:bg-red-900 text-white text-xs font-bold h-9 px-5 gap-2"
                        data-testid="reupload-fee-proof-cta"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>رفع إشعار تحويل جديد</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* State B: Proof uploaded & under review */}
              {(feePayment?.status === 'PROOF_UPLOADED' || feePayment?.status === 'UNDER_REVIEW') && (
                <Card className="border-blue-300 bg-blue-50/40 shadow-sm" data-testid="fee-under-review-banner">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-200 pb-3">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-blue-600 text-white font-bold text-xs gap-1 py-1 px-3">
                          <Clock className="w-3.5 h-3.5" />
                          <span>تم رفع الإشعار - قيد المراجعة الإدارية</span>
                        </Badge>
                        {feePayment.uploadedAt && (
                          <span className="text-xs text-muted-foreground">
                            رُفع في {new Date(feePayment.uploadedAt).toLocaleString('ar-SA')}
                          </span>
                        )}
                      </div>

                      {feePayment.proofFileUrl && (
                        <a
                          href={feePayment.proofFileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-blue-700 hover:text-blue-900 font-bold underline"
                          data-testid="view-uploaded-proof-link"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>معاينة الإشعار المرفوع</span>
                        </a>
                      )}
                    </div>

                    <div className="p-3.5 rounded-lg bg-white border border-blue-200 text-xs flex items-start gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <p className="text-slate-700 leading-relaxed">
                        يتم تدقيق الإشعار البنكي من قبل الفريق الإداري خلال 4 ساعات عمل وفق اتفاقية مستوى الخدمة (SLA). سيتم نشر العقار تلقائياً في السوق العام فور اعتماد التحويل.
                      </p>
                    </div>

                    <div className="flex justify-end pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowFeeModal(true)}
                        className="text-xs h-9 px-4 gap-2 border-slate-300 text-slate-700 hover:bg-slate-100"
                        data-testid="replace-fee-proof-cta"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>استبدال أو تعديل الإشعار</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* State C: No proof uploaded yet (Initial pending payment instructions) */}
              {(!feePayment || feePayment.status === 'PENDING') && (
                <Card className="border-amber-300 bg-amber-50/30 shadow-sm" data-testid="fee-payment-banner">
                  <CardHeader className="p-5 border-b border-amber-200 bg-amber-100/50">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-1">
                        <CardTitle className="text-base font-bold text-amber-950 flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-amber-800" />
                          <span>المرحلة التالية: سداد رسوم العقد والتسويق (1,000 ريال)</span>
                        </CardTitle>
                        <CardDescription className="text-xs text-amber-900/80">
                          وفقاً لنظام الوساطة، يرجى تحويل الرسوم المقررة إلى الحساب البنكي الرسمي لمنصة المصايف خلال 7 أيام
                        </CardDescription>
                      </div>

                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-200/80 text-amber-900 text-xs font-bold">
                        <Clock className="w-3.5 h-3.5 text-amber-800" />
                        <span>مهلة السداد: {new Date(contract.expiresAt).toLocaleDateString('ar-SA')}</span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5 space-y-4">
                    <div className="p-4 rounded-xl bg-white border border-amber-200 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-muted-foreground block mb-0.5">اسم المستفيد:</span>
                        <strong className="text-foreground">شركة المصايف العقارية</strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground block mb-0.5">اسم البنك:</span>
                        <strong className="text-foreground">مصرف الراجحي</strong>
                      </div>
                      <div className="space-y-1">
                        <span className="text-muted-foreground block mb-0.5">رقم الآيبان (IBAN):</span>
                        <div className="flex items-center gap-2">
                          <code className="px-2 py-0.5 rounded bg-slate-100 font-mono font-bold text-slate-800 text-[11px] dir-ltr">
                            {PLATFORM_IBAN}
                          </code>
                          <CopyButton value={PLATFORM_IBAN} label="نسخ الآيبان" />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                      <p className="text-[11px] text-amber-900 leading-relaxed">
                        * ملاحظة: رسوم تسويق وإدراج العقار غير مستردة بعد بدء إجراءات التدقيق والنشر الإلكتروني.
                      </p>

                      <Button
                        type="button"
                        onClick={() => setShowFeeModal(true)}
                        className="w-full sm:w-auto bg-[#1B4332] hover:bg-[#143326] text-white text-xs font-bold h-10 px-6 gap-2"
                        data-testid="pay-fee-cta"
                      >
                        <span>سداد رسوم العقد ورفع الإشعار البنكي</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* OTP Verification Modal */}
      {showOtpModal && (
        <SignatureOtpModal
          open={showOtpModal}
          onClose={() => setShowOtpModal(false)}
          maskedMobile={contract.ownerMobile || ''}
          initialCooldownSeconds={60}
          onResendOtp={handleResendOtp}
          onConfirmSignature={handleConfirmSignature}
          isSubmitting={isSigning}
        />
      )}

      {/* Story 7.3: Contract Fee Payment Proof Upload Modal */}
      {showFeeModal && contract && (
        <ContractFeeProofModal
          open={showFeeModal}
          onClose={() => setShowFeeModal(false)}
          contractId={contract.id}
          onSuccess={() => {
            setSuccessBanner('تم رفع إشعار التحويل البنكي بنجاح وهو الآن قيد التدقيق الإداري.');
            fetchContract();
            fetchFeeStatus();
          }}
        />
      )}
    </div>
  );
}
