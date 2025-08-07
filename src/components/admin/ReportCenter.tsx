'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Download,
  FileText,
  BarChart,
  Users,
  Calendar,
  Filter,
  Settings,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  FileSpreadsheet
} from 'lucide-react';
import { proctorAPI } from '@/lib/proctor-api';

export default function ReportCenter() {
  const [loading, setLoading] = useState<string | null>(null);
  const [reportConfig, setReportConfig] = useState({
    cohortId: '',
    dateRange: 'last_7_days',
    includeDetails: true,
    includeCharts: true,
    format: 'pdf' as 'pdf' | 'excel'
  });

  const generateCohortReport = async () => {
    if (!reportConfig.cohortId) {
      alert('Please select a cohort');
      return;
    }

    try {
      setLoading('cohort');

      const blob = await proctorAPI.generateCohortReport(
        parseInt(reportConfig.cohortId),
        reportConfig.format
      );

      downloadFile(blob, `cohort-${reportConfig.cohortId}-report.${reportConfig.format}`);
    } catch (error) {
      console.error('Failed to generate cohort report:', error);
      alert('Failed to generate report. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const generateSystemReport = async () => {
    try {
      setLoading('system');

      const blob = await proctorAPI.generateSystemReport(reportConfig.format);
      downloadFile(blob, `system-integrity-report.${reportConfig.format}`);
    } catch (error) {
      console.error('Failed to generate system report:', error);
      alert('Failed to generate report. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const generateAlertsReport = async () => {
    try {
      setLoading('alerts');

      // For alerts, we can only export as CSV or Excel, not PDF
      const alertFormat = reportConfig.format === 'pdf' ? 'csv' : reportConfig.format;

      const blob = await proctorAPI.exportAlerts({
        format: alertFormat,
        dateRange: reportConfig.dateRange
      });

      downloadFile(blob, `alerts-report.${alertFormat}`);
    } catch (error) {
      console.error('Failed to generate alerts report:', error);
      alert('Failed to generate report. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const generateCustomReport = async () => {
    try {
      setLoading('custom');

      // This would be a more complex report with custom parameters
      const blob = await proctorAPI.generateCustomReport({
        dateRange: reportConfig.dateRange,
        includeDetails: reportConfig.includeDetails,
        includeCharts: reportConfig.includeCharts,
        format: reportConfig.format
      });

      downloadFile(blob, `custom-proctoring-report.${reportConfig.format}`);
    } catch (error) {
      console.error('Failed to generate custom report:', error);
      alert('Failed to generate report. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const downloadFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const reportTypes = [
    {
      id: 'cohort',
      title: 'Cohort Analysis Report',
      description: 'Detailed analysis of a specific cohort\'s integrity metrics, behavioral patterns, and assessment outcomes.',
      icon: Users,
      color: 'bg-blue-50 border-blue-200',
      iconColor: 'text-blue-600',
      action: generateCohortReport,
      requiresCohort: true
    },
    {
      id: 'system',
      title: 'System Integrity Report',
      description: 'Overall system performance, detection accuracy, and integrity monitoring statistics.',
      icon: BarChart,
      color: 'bg-green-50 border-green-200',
      iconColor: 'text-green-600',
      action: generateSystemReport,
      requiresCohort: false
    },
    {
      id: 'alerts',
      title: 'Alerts & Incidents Report',
      description: 'Summary of all alerts, incidents, and their resolutions over the selected time period.',
      icon: AlertTriangle,
      color: 'bg-orange-50 border-orange-200',
      iconColor: 'text-orange-600',
      action: generateAlertsReport,
      requiresCohort: false
    },
    {
      id: 'custom',
      title: 'Custom Analytics Report',
      description: 'Customizable report with selected metrics, visualizations, and detailed breakdowns.',
      icon: TrendingUp,
      color: 'bg-purple-50 border-purple-200',
      iconColor: 'text-purple-600',
      action: generateCustomReport,
      requiresCohort: false
    }
  ];

  const dateRangeOptions = [
    { value: 'last_24_hours', label: 'Last 24 Hours' },
    { value: 'last_7_days', label: 'Last 7 Days' },
    { value: 'last_30_days', label: 'Last 30 Days' },
    { value: 'last_90_days', label: 'Last 90 Days' },
    { value: 'current_month', label: 'Current Month' },
    { value: 'last_month', label: 'Last Month' },
    { value: 'current_year', label: 'Current Year' }
  ];

  return (
    <div className="space-y-6">
      {/* Report Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Report Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Cohort Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Cohort ID</label>
              <input
                type="text"
                placeholder="Enter cohort ID"
                value={reportConfig.cohortId}
                onChange={(e) => setReportConfig(prev => ({ ...prev, cohortId: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium mb-2">Date Range</label>
              <select
                value={reportConfig.dateRange}
                onChange={(e) => setReportConfig(prev => ({ ...prev, dateRange: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                {dateRangeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Format */}
            <div>
              <label className="block text-sm font-medium mb-2">Format</label>
              <select
                value={reportConfig.format}
                onChange={(e) => setReportConfig(prev => ({ ...prev, format: e.target.value as 'pdf' | 'excel' }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value="pdf">PDF Report</option>
                <option value="excel">Excel Spreadsheet</option>
              </select>
            </div>

            {/* Options */}
            <div>
              <label className="block text-sm font-medium mb-2">Options</label>
              <div className="space-y-2">
                <label className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={reportConfig.includeDetails}
                    onChange={(e) => setReportConfig(prev => ({ ...prev, includeDetails: e.target.checked }))}
                    className="mr-2"
                  />
                  Include detailed data
                </label>
                <label className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={reportConfig.includeCharts}
                    onChange={(e) => setReportConfig(prev => ({ ...prev, includeCharts: e.target.checked }))}
                    className="mr-2"
                  />
                  Include charts
                </label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Types */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reportTypes.map((report) => {
          const Icon = report.icon;
          const isLoading = loading === report.id;
          const canGenerate = !report.requiresCohort || reportConfig.cohortId;

          return (
            <Card key={report.id} className={`${report.color} transition-all duration-200 hover:shadow-md`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-white shadow-sm`}>
                      <Icon className={`h-6 w-6 ${report.iconColor}`} />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{report.title}</CardTitle>
                      {report.requiresCohort && (
                        <Badge variant="outline" className="mt-1">Requires Cohort ID</Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {reportConfig.format === 'pdf' ? (
                      <FileText className="h-5 w-5 text-gray-500" />
                    ) : (
                      <FileSpreadsheet className="h-5 w-5 text-gray-500" />
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 mb-4 text-sm">{report.description}</p>

                <div className="flex justify-between items-center">
                  <div className="text-xs text-gray-500">
                    Format: {reportConfig.format.toUpperCase()} •
                    Range: {dateRangeOptions.find(opt => opt.value === reportConfig.dateRange)?.label}
                  </div>

                  <Button
                    onClick={report.action}
                    disabled={isLoading || !canGenerate}
                    className="flex items-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <Clock className="h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        Generate
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Reports */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Quick Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              onClick={generateSystemReport}
              disabled={loading === 'quick_system'}
              className="flex flex-col items-center gap-2 h-20"
            >
              <BarChart className="h-6 w-6" />
              <span className="text-sm">System Status</span>
            </Button>

            <Button
              variant="outline"
              onClick={generateAlertsReport}
              disabled={loading === 'quick_alerts'}
              className="flex flex-col items-center gap-2 h-20"
            >
              <AlertTriangle className="h-6 w-6" />
              <span className="text-sm">Recent Alerts</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                setReportConfig(prev => ({ ...prev, dateRange: 'last_24_hours' }));
                generateCustomReport();
              }}
              disabled={loading === 'quick_daily'}
              className="flex flex-col items-center gap-2 h-20"
            >
              <Calendar className="h-6 w-6" />
              <span className="text-sm">Daily Summary</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Recent Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="font-medium">System Integrity Report</div>
                <div className="text-sm text-gray-600">Generated 2 hours ago • PDF • 2.3 MB</div>
              </div>
              <Button size="sm" variant="outline">
                <Download className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="font-medium">Cohort 42 Analysis</div>
                <div className="text-sm text-gray-600">Generated yesterday • Excel • 1.8 MB</div>
              </div>
              <Button size="sm" variant="outline">
                <Download className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="font-medium">Weekly Alerts Summary</div>
                <div className="text-sm text-gray-600">Generated 3 days ago • PDF • 890 KB</div>
              </div>
              <Button size="sm" variant="outline">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
