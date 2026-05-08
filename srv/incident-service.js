import cds from '@sap/cds';

export default cds.service.impl(async function () {

    const { IncidentClusters } = this.entities;

    this.after('READ', IncidentClusters, (data) => {

        const records = Array.isArray(data) ? data : [data];

        records.forEach(record => {

            switch (record.severity) {

                case 'CRITICAL':
                    record.severityCriticality = 1; // Red
                    break;

                case 'HIGH':
                    record.severityCriticality = 2; // Orange
                    break;

                case 'MEDIUM':
                    record.severityCriticality = 3; // Yellow
                    break;

                case 'LOW':
                    record.severityCriticality = 5; // Green
                    break;

                default:
                    record.severityCriticality = 0;
            }
        });
    });
});