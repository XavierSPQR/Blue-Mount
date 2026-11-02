import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { COMPANY_NAME } from "@/lib/companyInfo";
import { formatPeriod } from "@/lib/format";
import type { Payslip } from "@/types/payslip";

const TYPE_LABEL: Record<string, string> = {
  fertilizer: "Fertilizer",
  teaPowder: "Tea Powder",
  advance: "Advance",
};

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11, fontFamily: "Helvetica", color: "#111827" },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 2 },
  subtitle: { fontSize: 11, color: "#6b7280", marginBottom: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginTop: 16, marginBottom: 6 },
  tableHeader: {
    flexDirection: "row",
    borderBottom: 1,
    borderColor: "#111827",
    paddingBottom: 4,
    fontWeight: 700,
  },
  tableRow: { flexDirection: "row", borderBottom: 1, borderColor: "#e5e7eb", paddingVertical: 4 },
  totalRow: { flexDirection: "row", borderTop: 1, borderColor: "#111827", paddingTop: 4, fontWeight: 700 },
  cell: { flex: 2 },
  cellRight: { flex: 1, textAlign: "right" },
  netBlock: { marginTop: 20, alignItems: "flex-end" },
  netAmount: { fontSize: 15, fontWeight: 700 },
  footer: { marginTop: 28, fontSize: 9, color: "#9ca3af" },
});

export function PayslipDocument({ payslip }: { payslip: Payslip }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{COMPANY_NAME}</Text>
        <Text style={styles.subtitle}>Pay Slip</Text>

        <View style={styles.row}>
          <Text>
            Supplier: {payslip.supplierName} ({payslip.supplierId})
          </Text>
          <Text>
            Period: {formatPeriod(payslip.periodStart, payslip.periodEnd)}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Collections</Text>
        <View style={styles.tableHeader}>
          <Text style={styles.cell}>Grade</Text>
          <Text style={styles.cellRight}>Quantity (kg)</Text>
          <Text style={styles.cellRight}>Amount (LKR)</Text>
        </View>
        {payslip.gradeBreakdown.map((g) => (
          <View style={styles.tableRow} key={g.gradeId}>
            <Text style={styles.cell}>{g.gradeName}</Text>
            <Text style={styles.cellRight}>{g.quantityKg.toFixed(1)}</Text>
            <Text style={styles.cellRight}>{g.amount.toFixed(2)}</Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.cell}>Gross Total</Text>
          <Text style={styles.cellRight}>{payslip.grossKg.toFixed(1)}</Text>
          <Text style={styles.cellRight}>{payslip.grossAmount.toFixed(2)}</Text>
        </View>

        <Text style={styles.sectionTitle}>Deductions</Text>
        {payslip.deductions.length === 0 ? (
          <Text>None</Text>
        ) : (
          <>
            {payslip.deductions.map((d) => (
              <View style={styles.row} key={d.deductionId}>
                <Text>{TYPE_LABEL[d.type] ?? d.type}</Text>
                <Text>{d.amount.toFixed(2)}</Text>
              </View>
            ))}
            <View style={[styles.row, { fontWeight: 700, marginTop: 4 }]}>
              <Text>Total Deductions</Text>
              <Text>{payslip.deductionTotal.toFixed(2)}</Text>
            </View>
          </>
        )}

        <View style={styles.netBlock}>
          <Text style={styles.netAmount}>Net Pay: LKR {payslip.netAmount.toFixed(2)}</Text>
        </View>

        <Text style={styles.footer}>Printed on {new Date().toLocaleDateString()}</Text>
      </Page>
    </Document>
  );
}
