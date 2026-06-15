import cds from '@sap/cds';
import { getDestination } from '@sap-cloud-sdk/connectivity';
import { executeHttpRequest } from '@sap-cloud-sdk/http-client';
import { runPoll } from './utils/log-helper.js';
export default cds.service.impl(async function () {
const db = await cds.connect.to('db');

const {
  Tenants,
  Incidents,
  IncidentClusters,
  Playbooks,
  MonitoredArtifacts,
  ClusterArtifacts
} = db.entities('com.cytechies.integration.reliability');
    const srv = this;
    this.on('triggerManualPoll', async (req) => {

         try {

        const tenants = await SELECT.from(Tenants).where({ isActive: true });
console.log(`Active Tenants Found: ${tenants.length}`);
        const allResults = [];

        for (const tenant of tenants) {

          try {

            const tenantResults = await runPoll({srv,
            Incidents,
            IncidentClusters,
            Playbooks,
            MonitoredArtifacts,
            ClusterArtifacts,
            tenant});

            allResults.push(...tenantResults);

          } catch (err) {

            console.error(
              `Polling failed for tenant ${tenant.tenantName}`,
              err
            );

            // Continue with next tenant
          }
        }

        console.log(`Total Failed Logs Processed: ${allResults.length}`);
        console.log("========== getFailedLogs BACKGROUND SUCCESS ==========");
                return {status: 'success', processedLogs: allResults.length};


      } catch (err) {

        console.error("========== getFailedLogs BACKGROUND FAILED ==========");
        console.error(err);
        return {status: 'error', message: err.message || 'An error occurred during manual polling.'};

      }
    });
    this.on('getDestinations', async (req) => {
        const destinationService = await getDestination({ destinationName: 'Destination_Service' });
        const destinations = await executeHttpRequest(destinationService, {
            method: 'GET',
            url: '/destination-configuration/v1/subaccountDestinations'
        });
        return destinations.data.map(d => ({
            Name: d.Name,
            Type: d.Type,
            URL: d.URL,
            Description: d.Description || ''
        }));
    });
});
