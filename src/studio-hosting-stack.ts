// src/studio-hosting-stack.ts
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';

export interface StudioHostingProps extends cdk.StackProps {
  studioBucketName?: string;
}

export class StudioHostingStack extends cdk.Stack {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props?: StudioHostingProps) {
    super(scope, id, props);

    const bucketName = props?.studioBucketName
      ?? `supabase-studio-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}`;

    // S3 bucket (private)
    this.bucket = new s3.Bucket(this, 'StudioBucket', {
      bucketName,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      enforceSSL: true,
      publicReadAccess: false,
      // optional: versioned: true
    });

    // Origin Access Identity (OAI)
    const oai = new cloudfront.OriginAccessIdentity(this, 'StudioOAI', {
      comment: `OAI for ${this.stackName} studio`,
    });

    // grant CloudFront read access on the bucket
    this.bucket.grantRead(oai);

    // CloudFront distribution
    this.distribution = new cloudfront.Distribution(this, 'StudioDistribution', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: new origins.S3Origin(this.bucket, { originAccessIdentity: oai }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      // short-lived cache policy fine for SPA; change caching as needed
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(0),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(0),
        },
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, 'StudioBucketName', { value: this.bucket.bucketName });
    new cdk.CfnOutput(this, 'CloudFrontDomain', { value: this.distribution.distributionDomainName });
  }
}
