import type { PrintableContact, PrintableParcel, WaybillPrintModel } from "../types/waybillPrint.types";
import { BarcodeSvg } from "./BarcodeSvg";
import { displayMoney, displayWeight } from "../utils/formatPrint";

const payments = { ngttn: "Người gửi trả tiền ngay", ngtts: "Người gửi trả tiền sau", nntn: "Người nhận trả tiền" };

function Contact({ title, contact }: { title: string; contact: PrintableContact }) {
  return <section className="wp-contact"><h3>{title}</h3><strong>{contact.name}</strong><p>{contact.phoneDisplay ?? "Chưa có số điện thoại được phép hiển thị"}</p><p>{contact.addressDisplay}</p></section>;
}

export function WaybillA4Template({ model }: { model: WaybillPrintModel }) {
  return <article className="wp-document wp-a4"><header><strong>Vietstar Logistics</strong><h2>PHIẾU GỬI HÀNG</h2><p className="wp-demo">BẢN MINH HỌA — KHÔNG DÙNG VẬN CHUYỂN</p></header><BarcodeSvg value={model.trackingCode} maxLength={35} availableWidthMm={190} /><div className="wp-contact-grid"><Contact title="Người gửi" contact={model.sender} /><Contact title="Người nhận" contact={model.receiver} /></div><dl className="wp-detail-grid"><dt>Bưu cục gửi / nhận</dt><dd>{model.originBranchName ?? "Chưa có dữ liệu"} / {model.destinationBranchName ?? "Chưa có dữ liệu"}</dd><dt>Dịch vụ</dt><dd>{model.serviceName ?? "Chưa có dữ liệu"}</dd><dt>Số kiện</dt><dd>{model.parcelCount}</dd><dt>Trọng lượng thực / quy đổi / tính cước</dt><dd>{displayWeight(model.actualWeightGram)} / {displayWeight(model.volumetricWeightGram)} / {displayWeight(model.chargeableWeightGram)}</dd><dt>Cước chính</dt><dd>{displayMoney(model.baseFreightAmount)}</dd><dt>Phụ phí / DVGT</dt><dd>{displayMoney(model.surchargeAmount)} / {displayMoney(model.vasAmount)}</dd><dt>Chiết khấu / VAT</dt><dd>{displayMoney(model.discountAmount)} / {displayMoney(model.vatAmount)}</dd><dt>Tổng cước vận chuyển</dt><dd>{displayMoney(model.freightAmount)}</dd><dt>COD — tiền thu hộ riêng</dt><dd>{displayMoney(model.codAmount)}</dd><dt>Khai giá</dt><dd>{displayMoney(model.declaredValue)}</dd><dt>Thanh toán cước</dt><dd>{payments[model.paymentMethod]}</dd><dt>Ngày tạo</dt><dd>{model.createdAt}</dd></dl><table className="wp-parcels"><thead><tr><th>Kiện</th><th>Mã kiện đã cấp</th><th>Trọng lượng thực</th></tr></thead><tbody>{[...model.parcels].sort((a, b) => a.parcelSequence - b.parcelSequence).map((parcel) => <tr key={parcel.parcelBarcode}><td>{parcel.parcelSequence}/{model.parcelCount}</td><td>{parcel.parcelBarcode}</td><td>{displayWeight(parcel.actualWeightGram)}</td></tr>)}</tbody></table></article>;
}

export function WaybillLabelTemplate({ model }: { model: WaybillPrintModel }) {
  return <article className="wp-document wp-label"><header><strong>Vietstar Logistics</strong><h2>TEM VẬN ĐƠN</h2><p className="wp-demo">BẢN MINH HỌA</p></header><BarcodeSvg value={model.trackingCode} maxLength={35} availableWidthMm={92} /><Contact title="Người nhận" contact={model.receiver} /><p>{model.destinationBranchName ?? "Chưa có bưu cục đích"}</p><p>{model.serviceName ?? "Chưa có dịch vụ"} · {model.parcelCount} kiện</p><p>Trọng lượng tính cước: {displayWeight(model.chargeableWeightGram)}</p><p>COD riêng: {displayMoney(model.codAmount)}</p></article>;
}

export function BarcodeStickerTemplate({ model, parcel }: { model: WaybillPrintModel; parcel: PrintableParcel }) {
  return <article className="wp-document wp-sticker"><header><strong>Vietstar Logistics · MINH HỌA</strong></header><p>Kiện {parcel.parcelSequence}/{model.parcelCount}</p><BarcodeSvg value={parcel.parcelBarcode} availableWidthMm={62} /><p className="wp-code">Vận đơn: {model.trackingCode}</p><p>Trọng lượng thực: {displayWeight(parcel.actualWeightGram)}</p></article>;
}
